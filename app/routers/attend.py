"""Davomat belgilash: QR → GPS → passkey/yuz → yozuv."""
import random

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import face_engine as fe
from app import passkeys
from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.models import (
    Attendance, AttStatus, AuditLog, Credential, FaceTemplate, Lesson,
    LessonSession, Role, Room, User, aware, now_utc,
)
from app.schemas import AttendBegin, FaceFinish, PasskeyFinish
from app.security import (
    GeoError, QRError, check_geofence, client_ip, device_hash, make_attempt,
    parse_qr_token, read_attempt, token_age_seconds, verify_qr_token,
)

router = APIRouter(prefix="/api/attend", tags=["attend"])

ERRORS_UZ = {
    "token_malformed": "QR kod noto'g'ri",
    "token_expired": "QR kod eskirgan — ekrandagi yangi kodni skanerlang",
    "token_future": "Qurilma soati noto'g'ri",
    "token_bad_signature": "QR kod yaroqsiz",
    "location_required": "Joylashuvga ruxsat bering",
    "location_inaccurate": "GPS aniqligi past — ochiq joyga chiqing yoki kuting",
    "too_far": "Siz auditoriyadan uzoqdasiz",
}


async def _log(db, **kw):
    db.add(AuditLog(**kw))


@router.post("/begin")
async def begin(
    body: AttendBegin,
    request: Request,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != Role.student.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Faqat talabalar uchun")

    ip = client_ip(request.headers, request.client.host if request.client else None)
    dev = device_hash(body.device, request.headers.get("user-agent"))

    # 1) Tokendan lesson_id ni olamiz (imzosiz), sessiyani topamiz
    try:
        lesson_id, _, _ = parse_qr_token(body.qr_token)
    except QRError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, ERRORS_UZ.get(str(e), "QR xato")) from e

    ls = await db.scalar(select(LessonSession).where(LessonSession.lesson_id == lesson_id))
    lesson = await db.scalar(
        select(Lesson).where(Lesson.id == lesson_id).options(selectinload(Lesson.subject))
    )
    if not ls or not lesson or not ls.is_open or aware(ls.closes_at) < now_utc():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bu dars davomati yopilgan")

    # 2) Talaba shu guruhdanmi?
    if user.group_id != lesson.group_id:
        await _log(db, user_id=user.id, lesson_id=lesson_id, action="attend_begin",
                   ok=False, reason="wrong_group", ip=ip, device_hash=dev)
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu dars sizning guruhingiz emas")

    # 3) QR imzo + yosh
    try:
        verify_qr_token(body.qr_token, ls.secret)
    except QRError as e:
        await _log(db, user_id=user.id, lesson_id=lesson_id, action="attend_begin",
                   ok=False, reason=str(e), ip=ip, device_hash=dev)
        await db.commit()
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, ERRORS_UZ.get(str(e), "QR xato")
        ) from e

    # 4) Geofence
    room = await db.get(Room, lesson.room_id) if lesson.room_id else None
    skip_geo = settings.demo_mode and settings.demo_skip_geofence
    try:
        distance = None if skip_geo else check_geofence(
            body.lat, body.lng, body.accuracy,
            room.lat if room else None, room.lng if room else None,
            ls.geofence_radius_m or settings.default_geofence_radius_m,
        )
    except GeoError as e:
        await _log(db, user_id=user.id, lesson_id=lesson_id, action="attend_begin",
                   ok=False, reason=e.code, ip=ip, device_hash=dev,
                   meta={"distance": e.distance})
        await db.commit()
        msg = ERRORS_UZ.get(e.code, "Joylashuv tekshiruvi o'tmadi")
        if e.code == "too_far" and e.distance:
            msg += f" (~{int(e.distance)} m)"
        raise HTTPException(status.HTTP_403_FORBIDDEN, msg) from e

    # 5) Allaqachon belgilanganmi?
    existing = await db.scalar(
        select(Attendance).where(
            Attendance.lesson_id == lesson_id, Attendance.user_id == user.id
        )
    )
    if existing and existing.status == AttStatus.present.value:
        return {"already": True, "message": "Davomatingiz allaqachon belgilangan ✅"}

    # 6) Tasdiqlash usulini tanlaymiz
    creds = (await db.scalars(
        select(Credential).where(Credential.user_id == user.id)
    )).all()
    faces = (await db.scalars(
        select(FaceTemplate).where(
            FaceTemplate.user_id == user.id, FaceTemplate.is_active.is_(True)
        )
    )).all()

    payload = {
        "k": "attend", "uid": user.id, "lid": lesson_id,
        "lat": body.lat, "lng": body.lng, "acc": body.accuracy,
        "dist": distance, "dev": dev, "ip": ip,
        "age": token_age_seconds(body.qr_token),
    }

    out: dict = {"lesson": _lesson_brief(lesson, room), "methods": []}

    # TEST REJIMI: biometrika o'chirilgan bo'lsa darhol belgilaymiz
    if settings.demo_mode and settings.demo_skip_biometry:
        await _log(db, user_id=user.id, lesson_id=lesson_id, action="attend_begin",
                   ok=True, reason="demo_skip_biometry", ip=ip, device_hash=dev)
        res = await _mark(db, user, payload, method="demo")
        res["lesson"] = out["lesson"]
        res["message"] = "⚠️ TEST REJIMI — biometrikasiz belgilandi"
        return res

    if creds:
        opts = passkeys.authentication_options([c.credential_id for c in creds])
        payload["pk_ch"] = opts["challenge"]
        out["passkey"] = {"options": opts}
        out["methods"].append("passkey")

    if faces and fe.available():
        seq = ["center"] + random.sample(["left", "right"], 1)
        payload["face_seq"] = seq
        out["face"] = {"sequence": seq}
        out["methods"].append("face")

    if not out["methods"]:
        raise HTTPException(
            status.HTTP_428_PRECONDITION_REQUIRED,
            "Avval shaxsingizni biriktiring — /enroll sahifasiga o'ting",
        )

    out["attempt"] = make_attempt(payload)
    await _log(db, user_id=user.id, lesson_id=lesson_id, action="attend_begin",
               ok=True, ip=ip, device_hash=dev, meta={"distance": distance})
    await db.commit()
    return out


def _lesson_brief(lesson: Lesson, room) -> dict:
    return {
        "id": lesson.id,
        "subject": lesson.subject.name if lesson.subject else "Dars",
        "room": room.name if room else None,
        "pair_no": lesson.pair_no,
    }


# ----------------------------------------------------------------- passkey

@router.post("/passkey")
async def finish_passkey(
    body: PasskeyFinish,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    data = _attempt_or_400(body.attempt, user.id)
    if "pk_ch" not in data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Passkey so'ralmagan")

    cid = passkeys.credential_id_from_response(body.credential)
    cred = await db.scalar(
        select(Credential).where(
            Credential.credential_id == cid, Credential.user_id == user.id
        )
    ) if cid else None
    if not cred:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu qurilma sizga biriktirilmagan")

    try:
        new_count = passkeys.verify_authentication(
            body.credential, data["pk_ch"], cred.public_key, cred.sign_count
        )
    except passkeys.PasskeyError as e:
        await _log(db, user_id=user.id, lesson_id=data["lid"], action="attend_verify",
                   ok=False, reason="passkey_failed", ip=data.get("ip"),
                   device_hash=data.get("dev"))
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Passkey tasdiqlanmadi") from e

    cred.sign_count = new_count
    cred.last_used_at = now_utc()
    return await _mark(db, user, data, method="passkey")


# --------------------------------------------------------------------- yuz

@router.post("/face")
async def finish_face(
    body: FaceFinish,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    data = _attempt_or_400(body.attempt, user.id)
    seq = data.get("face_seq")
    if not seq:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yuz tekshiruvi so'ralmagan")
    if not fe.available():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Yuz tanish o'chiq")
    if [f.kind for f in body.frames] != seq:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kadrlar ketma-ketligi mos emas")

    reads = []
    for frame, kind in zip(body.frames, seq):
        try:
            r = fe.read_face(frame.image)
        except fe.FaceError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, _face_msg(e.code)) from e
        if not fe.challenge_ok(kind, r):
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                "Ko'rsatilgan harakat bajarilmadi")
        reads.append(r)

    if not fe.frames_are_distinct(reads):
        await _log(db, user_id=user.id, lesson_id=data["lid"], action="attend_verify",
                   ok=False, reason="liveness_failed", ip=data.get("ip"),
                   device_hash=data.get("dev"))
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Jonli yuz aniqlanmadi (rasm ko'rsatilgan bo'lishi mumkin)")

    templates = [
        t for (t,) in (await db.execute(
            select(FaceTemplate.embedding).where(
                FaceTemplate.user_id == user.id, FaceTemplate.is_active.is_(True)
            )
        )).all()
    ]
    probe = fe.average_embedding(reads)
    ok, dist = fe.match(probe, templates)
    if not ok:
        await _log(db, user_id=user.id, lesson_id=data["lid"], action="attend_verify",
                   ok=False, reason="face_mismatch", ip=data.get("ip"),
                   device_hash=data.get("dev"), meta={"d": dist})
        await db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Yuz mos kelmadi — bu sizning akkauntingiz emas")

    return await _mark(db, user, data, method="face", extra={"face_distance": dist})


# ------------------------------------------------------------------ yozuv

async def _mark(db: AsyncSession, user: User, data: dict, method: str,
                extra: dict | None = None) -> dict:
    lesson_id = data["lid"]
    ls = await db.scalar(select(LessonSession).where(LessonSession.lesson_id == lesson_id))
    if not ls or not ls.is_open or aware(ls.closes_at) < now_utc():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Davomat oynasi yopildi")

    # Bitta qurilmadan boshqa talaba ham belgilanganmi?
    flagged, flag_reason = False, None
    same_dev = await db.scalar(
        select(Attendance).where(
            Attendance.lesson_id == lesson_id,
            Attendance.device_hash == data.get("dev"),
            Attendance.user_id != user.id,
        )
    )
    if same_dev:
        flagged, flag_reason = True, "shared_device"

    att = await db.scalar(
        select(Attendance).where(
            Attendance.lesson_id == lesson_id, Attendance.user_id == user.id
        )
    )
    if att is None:
        att = Attendance(lesson_id=lesson_id, user_id=user.id)
        db.add(att)

    att.status = AttStatus.present.value
    att.method = method
    att.marked_at = now_utc()
    att.lat, att.lng = data.get("lat"), data.get("lng")
    att.distance_m, att.accuracy_m = data.get("dist"), data.get("acc")
    att.device_hash, att.ip = data.get("dev"), data.get("ip")
    att.flagged, att.flag_reason = flagged, flag_reason

    db.add(AuditLog(
        user_id=user.id, lesson_id=lesson_id, action="attend_mark", ok=True,
        reason=method, ip=data.get("ip"), device_hash=data.get("dev"),
        meta={"distance": data.get("dist"), "token_age": data.get("age"), **(extra or {})},
    ))
    await db.commit()

    return {
        "ok": True,
        "method": method,
        "flagged": flagged,
        "message": "Davomatingiz belgilandi ✅",
    }


def _attempt_or_400(token: str, uid: int) -> dict:
    data = read_attempt(token)
    if not data or data.get("k") != "attend" or data.get("uid") != uid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Urinish eskirgan — QR ni qaytadan skanerlang")
    return data


def _face_msg(code: str) -> str:
    return {
        "no_face": "Yuz topilmadi — yorug'roq joyda urinib ko'ring",
        "multiple_faces": "Kadrda bir nechta yuz bor",
        "face_too_small": "Yuzni kameraga yaqinroq tuting",
    }.get(code, "Yuz o'qilmadi")


# -------------------------------------------------------------- talaba uchun

@router.get("/my")
async def my_attendance(user: User = Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Attendance, Lesson).join(Lesson, Lesson.id == Attendance.lesson_id)
        .options(selectinload(Lesson.subject))
        .where(Attendance.user_id == user.id)
        .order_by(Lesson.starts_at.desc()).limit(60)
    )).all()
    total = len(rows)
    present = sum(1 for a, _ in rows if a.status == AttStatus.present.value)
    return {
        "percent": round(present / total * 100) if total else 0,
        "total": total,
        "present": present,
        "items": [
            {
                "date": aware(l.starts_at).isoformat(),
                "subject": l.subject.name if l.subject else "Dars",
                "pair_no": l.pair_no,
                "status": a.status,
                "method": a.method,
            }
            for a, l in rows
        ],
    }
