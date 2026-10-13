"""O'qituvchi: dars ochish, aylanuvchi QR, jonli ro'yxat, bekor qilish."""
import asyncio
import datetime as dt
import io
import json

import segno
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import SessionLocal, get_db
from app.deps import require_staff, require_teacher
from app.models import (
    Attendance, AttStatus, AuditLog, Group, Lesson, LessonSession, LessonStatus,
    Role, Room, Subject, User, aware, now_utc,
)
from app.schemas import LessonCreate, OpenSession, ReviewAction
from app.security import make_qr_token, seconds_to_next_window

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


async def _lesson_or_404(db: AsyncSession, lesson_id: int) -> Lesson:
    lesson = await db.scalar(
        select(Lesson).where(Lesson.id == lesson_id).options(
            selectinload(Lesson.subject), selectinload(Lesson.group),
            selectinload(Lesson.room),
        )
    )
    if not lesson:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dars topilmadi")
    return lesson


def _can_touch(user: User, lesson: Lesson) -> bool:
    if user.role == Role.super_admin.value:
        return True
    if user.role == Role.teacher.value:
        return lesson.teacher_id in (None, user.id)
    if user.role == Role.starosta.value:
        return lesson.group_id == user.group_id
    return False


# ------------------------------------------------------------- darslar

@router.post("/lessons")
async def create_lesson(
    body: LessonCreate,
    user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    starts = (
        dt.datetime.fromisoformat(body.starts_at)
        if body.starts_at else dt.datetime.now(dt.timezone.utc)
    )
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=settings.tzinfo)
    lesson = Lesson(
        group_id=body.group_id, subject_id=body.subject_id, room_id=body.room_id,
        teacher_id=user.id, pair_no=body.pair_no,
        starts_at=starts, ends_at=starts + dt.timedelta(minutes=body.duration_min),
        status=LessonStatus.planned.value,
    )
    db.add(lesson)
    await db.commit()
    return {"id": lesson.id}


@router.get("/lessons/today")
async def lessons_today(
    user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)
):
    now = dt.datetime.now(settings.tzinfo)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    # Chegaralarni UTC ga keltiramiz — baza turidan qat'i nazar bir xil ishlaydi
    start_utc = start.astimezone(dt.timezone.utc)
    end_utc = start_utc + dt.timedelta(days=1)
    q = (
        select(Lesson)
        .options(selectinload(Lesson.subject), selectinload(Lesson.group),
                 selectinload(Lesson.room))
        .where(Lesson.starts_at >= start_utc, Lesson.starts_at < end_utc)
        .order_by(Lesson.starts_at)
    )
    if user.role == Role.teacher.value:
        q = q.where(Lesson.teacher_id == user.id)
    elif user.role == Role.starosta.value:
        q = q.where(Lesson.group_id == user.group_id)

    lessons = (await db.scalars(q)).all()
    return [
        {
            "id": l.id,
            "subject": l.subject.name if l.subject else "Dars",
            "group": l.group.code if l.group else None,
            "room": l.room.name if l.room else None,
            "pair_no": l.pair_no,
            "starts_at": aware(l.starts_at).isoformat(),
            "status": l.status,
        }
        for l in lessons
    ]


@router.post("/lessons/{lesson_id}/open")
async def open_lesson(
    lesson_id: int, body: OpenSession,
    user: User = Depends(require_teacher), db: AsyncSession = Depends(get_db),
):
    lesson = await _lesson_or_404(db, lesson_id)
    if not _can_touch(user, lesson):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")

    ls = await db.scalar(select(LessonSession).where(LessonSession.lesson_id == lesson_id))
    closes = now_utc() + dt.timedelta(minutes=body.window_minutes)
    radius = (
        body.geofence_radius_m
        or (lesson.room.radius_m if lesson.room else settings.default_geofence_radius_m)
    )
    if ls:
        ls.is_open, ls.closes_at, ls.geofence_radius_m = True, closes, radius
    else:
        ls = LessonSession(lesson_id=lesson_id, closes_at=closes, geofence_radius_m=radius)
        db.add(ls)
    lesson.status = LessonStatus.open.value
    db.add(AuditLog(user_id=user.id, lesson_id=lesson_id, action="lesson_open", ok=True))
    await db.commit()
    return {"ok": True, "closes_at": aware(closes).isoformat(), "radius_m": radius}


@router.post("/lessons/{lesson_id}/close")
async def close_lesson(
    lesson_id: int, user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    lesson = await _lesson_or_404(db, lesson_id)
    if not _can_touch(user, lesson):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")

    ls = await db.scalar(select(LessonSession).where(LessonSession.lesson_id == lesson_id))
    if ls:
        ls.is_open = False
    lesson.status = LessonStatus.closed.value

    # Belgilanmaganlarni "kelmadi" qilamiz
    students = (await db.scalars(
        select(User).where(
            User.group_id == lesson.group_id, User.role == Role.student.value,
            User.is_active.is_(True),
        )
    )).all()
    marked = {
        a.user_id for a in (await db.scalars(
            select(Attendance).where(Attendance.lesson_id == lesson_id)
        )).all()
    }
    for s in students:
        if s.id not in marked:
            db.add(Attendance(
                lesson_id=lesson_id, user_id=s.id, status=AttStatus.absent.value
            ))
    db.add(AuditLog(user_id=user.id, lesson_id=lesson_id, action="lesson_close", ok=True))
    await db.commit()
    return {"ok": True}


# ------------------------------------------------------------------- QR

@router.get("/lessons/{lesson_id}/qr")
async def qr_token(
    lesson_id: int, user: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    lesson = await _lesson_or_404(db, lesson_id)
    if not _can_touch(user, lesson):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")
    ls = await db.scalar(select(LessonSession).where(LessonSession.lesson_id == lesson_id))
    if not ls or not ls.is_open:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dars ochilmagan")
    if aware(ls.closes_at) < now_utc():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Davomat oynasi yopilgan")

    token = make_qr_token(lesson_id, ls.secret)
    url = f"{settings.base_url.rstrip('/')}/s/{token}"
    return {
        "token": token,
        "url": url,
        "svg": qr_svg(url),
        "rotate_in": round(seconds_to_next_window(), 2),
        "rotate_seconds": settings.qr_rotate_seconds,
        "closes_at": aware(ls.closes_at).isoformat(),
    }


def qr_svg(data: str) -> str:
    """QR serverda chiziladi — sayt hech qanday CDN ga bog'liq emas."""
    buf = io.BytesIO()
    segno.make(data, error="m").save(
        buf, kind="svg", scale=10, border=2,
        dark="#0b0b0b", light="#ffffff", omitsize=True, svgclass=None, lineclass=None,
    )
    return buf.getvalue().decode()


# ----------------------------------------------------- jonli ro'yxat (SSE)

async def _roster(db: AsyncSession, lesson: Lesson) -> dict:
    students = (await db.scalars(
        select(User).where(
            User.group_id == lesson.group_id, User.role == Role.student.value,
            User.is_active.is_(True),
        ).order_by(User.full_name)
    )).all()
    atts = {
        a.user_id: a for a in (await db.scalars(
            select(Attendance).where(Attendance.lesson_id == lesson.id)
        )).all()
    }
    items = []
    for s in students:
        a = atts.get(s.id)
        items.append({
            "user_id": s.id,
            "name": s.full_name,
            "status": a.status if a else "pending",
            "method": a.method if a else None,
            "at": aware(a.marked_at).isoformat() if a and a.marked_at else None,
            "flagged": bool(a.flagged) if a else False,
            "flag_reason": a.flag_reason if a else None,
            "distance_m": round(a.distance_m) if a and a.distance_m else None,
            "attendance_id": a.id if a else None,
        })
    present = sum(1 for i in items if i["status"] == AttStatus.present.value)
    return {"total": len(items), "present": present, "items": items}


@router.get("/lessons/{lesson_id}/roster")
async def roster(
    lesson_id: int, user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    lesson = await _lesson_or_404(db, lesson_id)
    if not _can_touch(user, lesson):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")
    return await _roster(db, lesson)


@router.get("/lessons/{lesson_id}/stream")
async def roster_stream(lesson_id: int, user: User = Depends(require_staff)):
    """Server-Sent Events — ro'yxat o'zgarganda o'qituvchi ekrani yangilanadi."""

    async def gen():
        last = None
        while True:
            async with SessionLocal() as db:
                lesson = await db.scalar(select(Lesson).where(Lesson.id == lesson_id))
                if not lesson:
                    break
                data = await _roster(db, lesson)
            payload = json.dumps(data, ensure_ascii=False)
            if payload != last:
                last = payload
                yield f"data: {payload}\n\n"
            else:
                yield ": ping\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ------------------------------------------------------------ tekshirish

@router.post("/review")
async def review(
    body: ReviewAction, user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    att = await db.get(Attendance, body.attendance_id)
    if not att:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Yozuv topilmadi")
    lesson = await _lesson_or_404(db, att.lesson_id)
    if not _can_touch(user, lesson):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")

    att.status = {
        "reject": AttStatus.rejected.value,
        "accept": AttStatus.present.value,
        "excuse": AttStatus.excused.value,
    }[body.action]
    att.reviewed_by, att.reviewed_at = user.id, now_utc()
    att.flagged = False
    if body.reason:
        att.reason = body.reason
    db.add(AuditLog(
        user_id=user.id, lesson_id=att.lesson_id, action="review",
        ok=True, reason=body.action, meta={"target": att.user_id},
    ))
    await db.commit()
    return {"ok": True, "status": att.status}


# ------------------------------------------------------------- guruhlar

@router.get("/subjects")
async def subjects(_: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Subject).order_by(Subject.name))).all()
    return [{"id": s.id, "name": s.name} for s in rows]


@router.get("/rooms")
async def rooms(_: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Room).order_by(Room.name))).all()
    return [
        {"id": r.id, "name": r.name, "building": r.building, "radius_m": r.radius_m}
        for r in rows
    ]


@router.get("/groups")
async def groups(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    q = select(Group).where(Group.is_active.is_(True)).order_by(Group.code)
    if user.role == Role.starosta.value:
        q = q.where(Group.id == user.group_id)
    gs = (await db.scalars(q)).all()
    out = []
    for g in gs:
        count = len((await db.scalars(
            select(User).where(User.group_id == g.id, User.role == Role.student.value)
        )).all())
        out.append({
            "id": g.id, "code": g.code, "students": count,
            "invite_url": f"{settings.base_url.rstrip('/')}/join/{g.invite_token}",
        })
    return out
