"""TEST REJIMI — faqat DEMO_MODE=true bo'lganda ulanadi.

Telegramsiz kirish imkonini beradi, LEKIN:
  • kirish faqat is_demo=True hisoblarga ruxsat etiladi;
  • GPS va biometrika tekshiruvlari o'z holicha ishlaydi
    (DEMO_SKIP_* kalitlari default o'chiq).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import face_engine
from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.models import Group, Lesson, LessonSession, Role, Room, User
from app.security import SESSION_COOKIE, SESSION_MAX_AGE, make_session
from app.templating import templates

router = APIRouter(tags=["demo"])

ROLE_UZ = {
    "super_admin": "Super admin",
    "teacher": "O'qituvchi",
    "starosta": "Starosta",
    "student": "Talaba",
}


class RoomHere(BaseModel):
    lat: float
    lng: float
    radius_m: int = 150


@router.get("/demo", response_class=HTMLResponse)
async def demo_page(request: Request, db: AsyncSession = Depends(get_db)):
    users = (await db.scalars(
        select(User).where(User.is_demo.is_(True), User.is_active.is_(True))
        .order_by(User.full_name)
    )).all()
    order = {"super_admin": 0, "teacher": 1, "starosta": 2, "student": 3}
    users = sorted(users, key=lambda u: (order.get(u.role, 9), u.full_name))

    groups = {
        g.id: g.code
        for g in (await db.scalars(select(Group))).all()
    }
    rooms = (await db.scalars(select(Room).order_by(Room.name))).all()
    lessons = (await db.scalars(
        select(Lesson).order_by(Lesson.starts_at.desc()).limit(5)
    )).all()
    open_ids = {
        ls.lesson_id for ls in (await db.scalars(
            select(LessonSession).where(LessonSession.is_open.is_(True))
        )).all()
    }

    return templates.TemplateResponse("demo.html", {
        "request": request,
        "app_name": settings.app_name,
        "user": None,
        "bot_username": settings.bot_username,
        "users": [
            {"id": u.id, "name": u.full_name, "role": u.role,
             "role_uz": ROLE_UZ.get(u.role, u.role),
             "group": groups.get(u.group_id), "enrolled": bool(u.enrolled_at)}
            for u in users
        ],
        "rooms": rooms,
        "lessons": [
            {"id": l.id, "pair_no": l.pair_no, "group": groups.get(l.group_id),
             "is_open": l.id in open_ids}
            for l in lessons
        ],
        "skip_geo": settings.demo_skip_geofence,
        "skip_bio": settings.demo_skip_biometry,
        "face_on": face_engine.available(),
    })


@router.post("/api/demo/login/{user_id}")
async def demo_login(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user or not user.is_demo:
        # Haqiqiy hisobga demo orqali kirib bo'lmaydi
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bu demo hisob emas")

    target = "/enroll" if (user.role == Role.student.value and not user.enrolled_at) \
        else "/"
    resp = RedirectResponse(target, status_code=303)
    resp.set_cookie(
        SESSION_COOKIE, make_session(user.id),
        max_age=SESSION_MAX_AGE, httponly=True, samesite="lax",
        secure=settings.base_url.startswith("https://"), path="/",
    )
    return resp


@router.post("/api/demo/room-here")
async def room_here(body: RoomHere, user: User = Depends(current_user),
                    db: AsyncSession = Depends(get_db)):
    """Barcha demo xonalarni hozirgi joylashuvga ko'chiradi.

    Shunda GPS tekshiruvi O'CHIRILMAGAN holda ham siz turgan joyda sinaladi.
    """
    if not user.is_demo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Faqat demo hisob uchun")
    rooms = (await db.scalars(select(Room))).all()
    for r in rooms:
        r.lat, r.lng, r.radius_m = body.lat, body.lng, max(body.radius_m, 50)
    await db.commit()
    return {
        "ok": True,
        "rooms": len(rooms),
        "lat": body.lat,
        "lng": body.lng,
        "radius_m": max(body.radius_m, 50),
    }
