"""TEST REJIMI uchun demo ma'lumot.

Yaratadi: o'qituvchi, starosta, 12 talaba, bugungi 3 ta dars.
Barcha hisoblar `is_demo=True` — /demo orqali faqat shularga kirish mumkin.

    python seed_demo.py
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
MAIN_GROUP = "CYB3-26"

STUDENTS = [
    "Mamatqulov Zafar", "Karimov Aziz", "Yusupova Malika", "Toshmatov Bekzod",
    "Rahimova Nilufar", "Sobirov Jasur", "Ergashev Otabek", "Qodirova Sevinch",
    "Nazarov Sardor", "Umarova Zilola", "Xolmatov Rustam", "Sattorova Dilnoza",
]
SUBJECTS = [
    "Kiberxavfsizlik asoslari", "Matematik analiz", "Dasturlash",
    "Tarmoqlar", "Ingliz tili", "Kriptografiya",
]
ROOMS = ["A-301", "A-302", "B-105"]

# Toshkent markazi — /demo sahifasidagi tugma bilan o'z joyingizga ko'chirasiz
LAT, LNG = 41.2646, 69.2163


async def get_or_create(db, model, where, **kw):
    obj = await db.scalar(select(model).where(where))
    if obj:
        return obj, False
    obj = model(**kw)
    db.add(obj)
    await db.flush()
    return obj, True


async def main() -> None:
    if not settings.demo_mode:
        print("⚠️  DEMO_MODE=false. .env da DEMO_MODE=true qiling, "
              "aks holda /demo sahifasi ochilmaydi.\n")

    await init_models()
    async with SessionLocal() as db:
        fac, _ = await get_or_create(
            db, Faculty, Faculty.code == "CYB",
            name="Kiberxavfsizlik muhandisligi", code="CYB",
        )

        groups = {}
        for code in GROUPS:
            g, _ = await get_or_create(
                db, Group, Group.code == code,
                code=code, faculty_id=fac.id, year=2026, invite_token=new_token(12),
            )
            groups[code] = g

        subjects = {}
        for name in SUBJECTS:
            s, _ = await get_or_create(db, Subject, Subject.name == name, name=name)
            subjects[name] = s

        rooms = {}
        for n in ROOMS:
            r, _ = await get_or_create(
                db, Room, Room.name == n,
                name=n, building="Asosiy", lat=LAT, lng=LNG,
                radius_m=settings.default_geofence_radius_m,
            )
            rooms[n] = r

        await db.commit()

        # --- odamlar (hammasi demo) ---
        teacher, _ = await get_or_create(
            db, User, User.phone == "+998900000001",
            full_name="Olimov Jahongir", phone="+998900000001",
            role=Role.teacher.value, is_demo=True,
        )
        starosta, _ = await get_or_create(
            db, User, User.phone == "+998900000002",
            full_name="Karimov Aziz", phone="+998900000002",
            role=Role.starosta.value, group_id=groups[MAIN_GROUP].id, is_demo=True,
        )
        groups[MAIN_GROUP].starosta_id = starosta.id

        made = 0
        for i, name in enumerate(STUDENTS):
            if name == starosta.full_name:
                continue
            phone = f"+99890000{1000 + i}"
            _, created = await get_or_create(
                db, User, User.phone == phone,
                full_name=name, phone=phone, role=Role.student.value,
                group_id=groups[MAIN_GROUP].id, is_demo=True,
            )
            made += int(created)

        # --- bugungi darslar ---
        now = dt.datetime.now(settings.tzinfo)
        day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        plan = [
            (1, "Kiberxavfsizlik asoslari", "A-301", 9, 0),
            (2, "Dasturlash", "A-302", 10, 40),
            (3, "Matematik analiz", "B-105", 13, 0),
        ]
        lessons = 0
        for pair_no, subject, room, h, m in plan:
            starts = (day + dt.timedelta(hours=h, minutes=m)).astimezone(dt.timezone.utc)
            exists = await db.scalar(
                select(Lesson).where(
                    Lesson.group_id == groups[MAIN_GROUP].id,
                    Lesson.pair_no == pair_no,
                    Lesson.starts_at == starts,
                )
            )
            if exists:
                continue
            db.add(Lesson(
                group_id=groups[MAIN_GROUP].id, subject_id=subjects[subject].id,
                room_id=rooms[room].id, teacher_id=teacher.id, pair_no=pair_no,
                starts_at=starts, ends_at=starts + dt.timedelta(minutes=80),
                status=LessonStatus.planned.value,
            ))
            lessons += 1

        await db.commit()

        base = settings.base_url.rstrip("/")
        print(f"""
✅ Demo ma'lumot tayyor

   O'qituvchi : {teacher.full_name}
   Starosta   : {starosta.full_name}  ({MAIN_GROUP})
   Talabalar  : +{made} ta (jami {len(STUDENTS)})
   Darslar    : +{lessons} ta (bugun)
   Xonalar    : {', '.join(ROOMS)} — {LAT}, {LNG}

   👉  {base}/demo   — shu yerdan parolsiz kiring

   Taklif havolalari (haqiqiy ro'yxatdan o'tishni sinash uchun):""")
        for code in GROUPS:
            print(f"     {code:10s} {base}/join/{groups[code].invite_token}")
        print("""
   GPS tekshiruvi YOQIQ — /demo sahifasidagi
   «📍 Xonani shu yerga qo'yish» tugmasini bosing.
""")


if __name__ == "__main__":
    asyncio.run(main())
