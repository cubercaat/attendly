from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import current_user_optional
from app.templating import templates
from app.models import Group, Role, User

router = APIRouter(tags=["pages"])


def ctx(request: Request, user: User | None = None, **kw) -> dict:
    return {
        "request": request,
        "user": user,
        "app_name": settings.app_name,
        "bot_username": settings.bot_username,
        **kw,
    }


@router.get("/", response_class=HTMLResponse)
async def home(request: Request, user: User | None = Depends(current_user_optional)):
    if not user:
        return templates.TemplateResponse("landing.html", ctx(request))
    if user.role == Role.student.value:
        if not user.enrolled_at:
            return RedirectResponse("/enroll", status_code=302)
        return RedirectResponse("/scan", status_code=302)
    return RedirectResponse("/dashboard", status_code=302)


@router.get("/join/{invite}", response_class=HTMLResponse)
async def join(invite: str, request: Request, db: AsyncSession = Depends(get_db)):
    group = await db.scalar(
        select(Group).where(Group.invite_token == invite, Group.is_active.is_(True))
    )
    return templates.TemplateResponse(
        "join.html", ctx(request, group=group, invite=invite)
    )


@router.get("/enroll", response_class=HTMLResponse)
async def enroll(request: Request, user: User | None = Depends(current_user_optional)):
    if not user:
        return RedirectResponse("/", status_code=302)
    return templates.TemplateResponse("enroll.html", ctx(request, user))


@router.get("/scan", response_class=HTMLResponse)
async def scan(request: Request, user: User | None = Depends(current_user_optional)):
    if not user:
        return RedirectResponse("/", status_code=302)
    if not user.enrolled_at:
        return RedirectResponse("/enroll", status_code=302)
    return templates.TemplateResponse("scan.html", ctx(request, user, prefill=""))


@router.get("/s/{token}", response_class=HTMLResponse)
async def scan_deeplink(token: str, request: Request,
                        user: User | None = Depends(current_user_optional)):
    """QR to'g'ridan-to'g'ri kamera ilovasida ochilsa shu yerga tushadi."""
    if not user:
        return RedirectResponse("/", status_code=302)
    if not user.enrolled_at:
        return RedirectResponse("/enroll", status_code=302)
    return templates.TemplateResponse("scan.html", ctx(request, user, prefill=token))


@router.get("/me", response_class=HTMLResponse)
async def me_page(request: Request, user: User | None = Depends(current_user_optional)):
    if not user:
        return RedirectResponse("/", status_code=302)
    return templates.TemplateResponse("me.html", ctx(request, user))


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, user: User | None = Depends(current_user_optional)):
    if not user or not user.is_staff:
        return RedirectResponse("/", status_code=302)
    return templates.TemplateResponse("dashboard.html", ctx(request, user))


@router.get("/teacher/lesson/{lesson_id}/qr", response_class=HTMLResponse)
async def teacher_qr(lesson_id: int, request: Request,
                     user: User | None = Depends(current_user_optional)):
    if not user or not user.is_staff:
        return RedirectResponse("/", status_code=302)
    return templates.TemplateResponse(
        "teacher_qr.html", ctx(request, user, lesson_id=lesson_id)
    )
