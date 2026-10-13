from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Role, User
from app.security import SESSION_COOKIE, read_session


async def current_user_optional(
    request: Request, db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    uid = read_session(request.cookies.get(SESSION_COOKIE))
    if not uid:
        return None
    user = await db.scalar(select(User).where(User.id == uid, User.is_active.is_(True)))
    return user


async def current_user(
    user: Optional[User] = Depends(current_user_optional),
) -> User:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Tizimga kiring")
    return user


def require_roles(*roles: Role):
    allowed = {r.value for r in roles}

    async def _check(user: User = Depends(current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")
        return user

    return _check


require_staff = require_roles(Role.super_admin, Role.teacher, Role.starosta)
require_teacher = require_roles(Role.super_admin, Role.teacher)
require_admin = require_roles(Role.super_admin)
require_student = require_roles(Role.student)
