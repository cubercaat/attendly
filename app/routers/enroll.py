"""Shaxsni biriktirish: passkey (asosiy) + yuz (zaxira)."""
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import face_engine as fe
from app import passkeys
from app.db import get_db
from app.deps import current_user
from app.models import AuditLog, Credential, FaceTemplate, User, now_utc
from app.schemas import EnrollPasskeyFinish, FaceEnroll
from app.security import make_attempt, read_attempt

router = APIRouter(prefix="/api/enroll", tags=["enroll"])


@router.get("/status")
async def enroll_status(user: User = Depends(current_user),
                        db: AsyncSession = Depends(get_db)):
    creds = (await db.scalars(
        select(Credential).where(Credential.user_id == user.id)
    )).all()
    faces = (await db.scalars(
        select(FaceTemplate).where(
            FaceTemplate.user_id == user.id, FaceTemplate.is_active.is_(True)
        )
    )).all()
    return {
        "passkeys": [
            {"id": c.id, "label": c.device_label, "created": c.created_at.isoformat()}
            for c in creds
        ],
        "face_enrolled": len(faces) > 0,
        "face_available": fe.available(),
        "complete": bool(user.enrolled_at),
    }


# ------------------------------------------------------------- passkey

@router.post("/passkey/begin")
async def passkey_begin(user: User = Depends(current_user)):
    opts = passkeys.registration_options(
        user_id=user.id,
        user_name=user.phone or f"user{user.id}",
        display_name=user.full_name,
    )
    attempt = make_attempt({"k": "enroll_pk", "uid": user.id, "ch": opts["challenge"]})
    return {"options": opts, "attempt": attempt}


@router.post("/passkey/complete")
async def passkey_complete(
    body: EnrollPasskeyFinish,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    data = read_attempt(body.attempt, max_age=300)
    if not data or data.get("k") != "enroll_pk" or data.get("uid") != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Urinish eskirgan")

    try:
        res = passkeys.verify_registration(body.credential, data["ch"])
    except passkeys.PasskeyError as e:
        db.add(AuditLog(user_id=user.id, action="enroll_passkey", ok=False, reason=e.code))
        await db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Passkey tasdiqlanmadi") from e

    exists = await db.scalar(
        select(Credential).where(Credential.credential_id == res["credential_id"])
    )
    if exists and exists.user_id != user.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bu qurilma boshqa talabaga biriktirilgan",
        )
    if not exists:
        db.add(Credential(
            user_id=user.id,
            credential_id=res["credential_id"],
            public_key=res["public_key"],
            sign_count=res["sign_count"],
            device_label=(body.device_label or "Qurilma")[:64],
        ))
    if not user.enrolled_at:
        user.enrolled_at = now_utc()
    db.add(AuditLog(user_id=user.id, action="enroll_passkey", ok=True))
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------- yuz

@router.get("/face/challenge")
async def face_challenge(user: User = Depends(current_user)):
    if not fe.available():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Yuz tanish o'chiq")
    order = ["center"] + random.sample(["left", "right"], 2)
    return {
        "challenge": make_attempt({"k": "enroll_face", "uid": user.id, "seq": order}),
        "sequence": order,
    }


@router.post("/face")
async def face_enroll(
    body: FaceEnroll,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if not fe.available():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Yuz tanish o'chiq")

    data = read_attempt(body.challenge, max_age=300)
    if not data or data.get("k") != "enroll_face" or data.get("uid") != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Urinish eskirgan")

    seq = data["seq"]
    if [f.kind for f in body.frames] != seq:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Kadrlar ketma-ketligi mos emas")

    reads = []
    for frame, kind in zip(body.frames, seq):
        try:
            r = fe.read_face(frame.image)
        except fe.FaceError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, _face_msg(e.code)) from e
        if not fe.challenge_ok(kind, r):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"«{_kind_uz(kind)}» qadami bajarilmadi — qaytadan urinib ko'ring",
            )
        reads.append(r)

    if not fe.frames_are_distinct(reads):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Kadrlar bir xil — jonli yuz emas (rasm ko'rsatilgan bo'lishi mumkin)",
        )

    emb = fe.average_embedding(reads)

    # Bu yuz boshqa talabaga biriktirilganmi?
    others = (await db.execute(
        select(FaceTemplate.user_id, FaceTemplate.embedding).where(
            FaceTemplate.is_active.is_(True), FaceTemplate.user_id != user.id
        )
    )).all()
    for other_uid, blob in others:
        ok, dist = fe.match(emb, [blob])
        if ok:
            db.add(AuditLog(
                user_id=user.id, action="enroll_face", ok=False,
                reason="duplicate_face", meta={"other_user": other_uid, "d": dist},
            ))
            await db.commit()
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Bu yuz boshqa talabaga biriktirilgan",
            )

    await db.execute(
        FaceTemplate.__table__.update()
        .where(FaceTemplate.user_id == user.id)
        .values(is_active=False)
    )
    db.add(FaceTemplate(
        user_id=user.id, embedding=fe.pack(emb),
        quality=float(min(r.det_score for r in reads)),
    ))
    if not user.enrolled_at:
        user.enrolled_at = now_utc()
    db.add(AuditLog(user_id=user.id, action="enroll_face", ok=True))
    await db.commit()
    return {"ok": True}


def _kind_uz(kind: str) -> str:
    return {"center": "To'g'ri qarang", "left": "Chapga buriling",
            "right": "O'ngga buriling"}.get(kind, kind)


def _face_msg(code: str) -> str:
    return {
        "no_face": "Yuz topilmadi — yorug'roq joyda urinib ko'ring",
        "multiple_faces": "Kadrda bir nechta yuz bor — yolg'iz turing",
        "face_too_small": "Yuzni kameraga yaqinroq tuting",
        "face_engine_unavailable": "Yuz tanish xizmati ishlamayapti",
    }.get(code, "Yuz o'qilmadi")
