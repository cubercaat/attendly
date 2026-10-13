"""Demo ma'lumot: fakultet, guruhlar (CYB1-26…CYB4-26), xona, fanlar, dars.

Ishlatish:  python seed.py
"""
import asyncio
import datetime as dt

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal, init_models
from app.models import (
    Faculty, Group, Lesson, LessonStatus, Role, Room, Subject, User, new_token,
)

GROUPS = ["CYB1-26", "CYB2-26", "CYB3-26", "CYB4-26"]
SUBJECTS = [
    "Kiberxavfsizlik asoslari", "Matematik analiz", "Dasturlash",
    "Tarmoqlar", "Ingliz tili", "Kriptografiya",
]
# TTPU — Qo'yliq, Toshkent (taxminiy; o'z binongiz koordinatasini qo'ying)
TTPU_LAT, TTPU_LNG = 41.2646, 69.2163


async def main() -> None:
    await init_models()
    async with SessionLocal() as db:
        fac = await db.scalar(select(Faculty).where(Faculty.code == "CYB"))
        if not fac:
            fac = Faculty(name="Kiberxavfsizlik muhandisligi", code="CYB")
            db.add(fac)
            await db.flush()

        for code in GROUPS:
            if not await db.scalar(select(Group).where(Group.code == code)):
                db.add(Group(code=code, faculty_id=fac.id, year=2026,
                             invite_token=new_token(12)))

        for name in SUBJECTS:
            if not await db.scalar(select(Subject).where(Subject.name == name)):
                db.add(Subject(name=name))

        for n in ("A-301", "A-302", "B-105"):
            if not await db.scalar(select(Room).where(Room.name == n)):
                db.add(Room(name=n, building="Asosiy", lat=TTPU_LAT, lng=TTPU_LNG,
                            radius_m=settings.default_geofence_radius_m))
        await db.commit()

        # namuna dars — bugun, hozirdan boshlab
        g = await db.scalar(select(Group).where(Group.code == "CYB3-26"))
        s = await db.scalar(select(Subject).where(Subject.name == SUBJECTS[0]))
        r = await db.scalar(select(Room).where(Room.name == "A-301"))
        t = await db.scalar(select(User).where(User.role == Role.teacher.value))
        now = dt.datetime.now(dt.timezone.utc)
        exists = await db.scalar(
            select(Lesson).where(Lesson.group_id == g.id, Lesson.starts_at >= now
                                 - dt.timedelta(hours=2))
        )
        if not exists:
            db.add(Lesson(
                group_id=g.id, subject_id=s.id, room_id=r.id,
                teacher_id=t.id if t else None, pair_no=1,
                starts_at=now, ends_at=now + dt.timedelta(minutes=80),
                status=LessonStatus.planned.value,
            ))
        await db.commit()

        print("\n✅ Demo ma'lumot tayyor.\n")
        print("Taklif havolalari:")
        for code in GROUPS:
            grp = await db.scalar(select(Group).where(Group.code == code))
            print(f"  {code:10s} {settings.base_url.rstrip('/')}/join/{grp.invite_token}")
        print(f"\nXona koordinatasi: {TTPU_LAT}, {TTPU_LNG} "
              f"(seed.py da o'z binongizga moslang)")
        print("\nBirinchi bo'lib /start bosgan SUPER_ADMIN_IDS egasi "
              "avtomatik super_admin bo'ladi.\n")


if __name__ == "__main__":
    asyncio.run(main())
