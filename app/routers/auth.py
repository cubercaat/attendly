import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import current_user_optional
from app.models import Group, LoginToken, Role, User, aware, now_utc
from app.security import SESSION_COOKIE, SESSION_MAX_AGE, make_session

router = APIRouter(tags=["auth"])


@router.get("/auth/{token}")
async def auth_bridge(token: str, db: AsyncSession = Depends(get_db)):
    """Botdan qaytish — bir martalik token sessiyaga aylanadi."""
    lt = await db.scalar(select(LoginToken).where(LoginToken.token == token))
    if not lt or lt.used_at is not None or aware(lt.expires_at) < now_utc():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Link eskirgan — botdan qayta oling")

    user = await db.get(User, lt.user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Foydalanuvchi faol emas")

    lt.used_at = now_utc()
    await db.commit()

    target = "/enroll" if (user.role == Role.student.value and not user.enrolled_at) else "/"
    resp = RedirectResponse(target, status_code=302)
    resp.set_cookie(
        SESSION_COOKIE, make_session(user.id),
        max_age=SESSION_MAX_AGE, httponly=True, samesite="lax",
        secure=settings.base_url.startswith("https://"), path="/",
    )
    return resp


@router.post("/logout")
async def logout():
    resp = RedirectResponse("/", status_code=302)
    resp.delete_cookie(SESSION_COOKIE, path="/")
    return resp


@router.get("/api/me")
async def me(user: User | None = Depends(current_user_optional),
             db: AsyncSession = Depends(get_db)):
    if not user:
        return {"authenticated": False}
    group = await db.get(Group, user.group_id) if user.group_id else None
    return {
        "authenticated": True,
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role,
        "group": group.code if group else None,
        "enrolled": bool(user.enrolled_at),
    }


@router.get("/api/group/{invite}")
async def group_by_invite(invite: str, db: AsyncSession = Depends(get_db)):
    group = await db.scalar(
        select(Group).where(Group.invite_token == invite, Group.is_active.is_(True))
    )
    if not group:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guruh topilmadi")
    return {"code": group.code, "invite": group.invite_token}
