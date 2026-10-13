"""Super admin: guruh, xona, fan, rol boshqaruvi."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import require_admin
from app.models import Faculty, Group, Role, Room, Subject, User, new_token
from app.schemas import GroupCreate, RoomCreate

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/groups")
async def create_group(body: GroupCreate, _: User = Depends(require_admin),
                       db: AsyncSession = Depends(get_db)):
    code = body.code.strip().upper()
    if await db.scalar(select(Group).where(Group.code == code)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu guruh allaqachon bor")
    g = Group(code=code, faculty_id=body.faculty_id, year=body.year,
              invite_token=new_token(12))
    db.add(g)
    await db.commit()
    return {
        "id": g.id, "code": g.code,
        "invite_url": f"{settings.base_url.rstrip('/')}/join/{g.invite_token}",
    }


@router.post("/groups/{group_id}/rotate-invite")
async def rotate_invite(group_id: int, _: User = Depends(require_admin),
                        db: AsyncSession = Depends(get_db)):
    g = await db.get(Group, group_id)
    if not g:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Guruh topilmadi")
    g.invite_token = new_token(12)
    await db.commit()
    return {"invite_url": f"{settings.base_url.rstrip('/')}/join/{g.invite_token}"}


@router.post("/users/{user_id}/role")
async def set_role(user_id: int, role: str, _: User = Depends(require_admin),
                   db: AsyncSession = Depends(get_db)):
    if role not in {r.value for r in Role}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Noto'g'ri rol")
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Topilmadi")
    u.role = role
    if role == Role.starosta.value and u.group_id:
        g = await db.get(Group, u.group_id)
        if g:
            g.starosta_id = u.id
    await db.commit()
    return {"ok": True, "role": u.role}


@router.post("/rooms")
async def create_room(body: RoomCreate, _: User = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    r = Room(name=body.name, building=body.building, lat=body.lat,
             lng=body.lng, radius_m=body.radius_m)
    db.add(r)
    await db.commit()
    return {"id": r.id}


@router.get("/rooms")
async def list_rooms(_: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    rooms = (await db.scalars(select(Room).order_by(Room.name))).all()
    return [
        {"id": r.id, "name": r.name, "building": r.building,
         "lat": r.lat, "lng": r.lng, "radius_m": r.radius_m}
        for r in rooms
    ]


@router.post("/subjects")
async def create_subject(name: str, code: str | None = None,
                         _: User = Depends(require_admin),
                         db: AsyncSession = Depends(get_db)):
    s = Subject(name=name, code=code)
    db.add(s)
    await db.commit()
    return {"id": s.id}


@router.get("/subjects")
async def list_subjects(_: User = Depends(require_admin),
                        db: AsyncSession = Depends(get_db)):
    rows = (await db.scalars(select(Subject).order_by(Subject.name))).all()
    return [{"id": s.id, "name": s.name} for s in rows]


@router.post("/faculties")
async def create_faculty(name: str, code: str, _: User = Depends(require_admin),
                         db: AsyncSession = Depends(get_db)):
    f = Faculty(name=name, code=code.upper())
    db.add(f)
    await db.commit()
    return {"id": f.id}


@router.get("/users")
async def list_users(role: str | None = None, group_id: int | None = None,
                     _: User = Depends(require_admin),
                     db: AsyncSession = Depends(get_db)):
    q = select(User).order_by(User.full_name)
    if role:
        q = q.where(User.role == role)
    if group_id:
        q = q.where(User.group_id == group_id)
    users = (await db.scalars(q.limit(500))).all()
    return [
        {"id": u.id, "name": u.full_name, "phone": u.phone, "role": u.role,
         "group_id": u.group_id, "enrolled": bool(u.enrolled_at),
         "telegram_id": u.telegram_id}
        for u in users
    ]
