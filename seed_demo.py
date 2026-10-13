"""TEST REJIMI uchun demo ma'lumot.

Yaratadi: 8 o'qituvchi, starosta, CYB3-26 (33 talaba) + boshqa guruhlarga 20 tadan talaba, 34 xona, bugungi jadval darslari.
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

# CYB3-26 — asosiy guruh (to'liq ro'yxat); boshqa guruhlarga 20 tadan tasodifiy ism
STUDENTS = [
    "Akbarxo'jayev Saidxo'ja", "Bekbo'tayev Ibrohim", "Bakhromov Shakhzod",
    "Baxtiyorov Abduqodir", "Nigmatov Abdurahim", "Muhammadjonov Sultonbek",
    "Shoniyozov Behruz", "Mirzaev Muzaffar", "Mo'minjonov Aliakbar",
    "Yunusov Raxim", "Fazliddin Sidikov", "Mamatqulov Zafar",
    "Mirrahimov Shaxzod", "Toychiev Shaxzod", "Ruzikulov Radmir",
    "Saidazim Saidganiev", "Ulug'bek Umarov", "Khabibullayev Asadulla",
    "Allamurodov Behruz", "Usmonxo'jayev Habibulloh", "G'ofurjonov Muhammad Yusuf",
    "Polatboyev Ibrohimboy", "Do'stbekova Muslima", "Kozimiy Abdulaziz",
    "Mirshokirov Ulug'bek", "Nazarov Iso", "Zabixullayev Said'azam",
    "Alimjanov Xondamir", "Firdavs Nurmatov", "Abdumajitov Shohjahon",
    "Erkinov Asilbek", "Subhonov Maqsud", "Vohidov Biloliddin",
]
FIRST = ["Sardor", "Jasur", "Bekzod", "Otabek", "Rustam", "Malika", "Nilufar",
         "Sevinch", "Zilola", "Dilnoza", "Madina", "Dilshod", "Sherzod", "Javohir"]
LAST = ["Karimov", "Toshmatov", "Rahimov", "Sobirov", "Ergashev", "Qodirov",
        "Xolmatov", "Sattorov", "Yusupov", "Umarov", "Hasanov", "Ismoilov"]
SUBJECTS = ["Matematika 1", "Ingliz tili 1", "Fizika 1", "Dasturlash", "PHS", "NHU"]
ROOMS = [
    "101 Chem LAB", "105", "107", "201", "203", "204", "205", "206", "207", "301",
    "303", "304", "305", "306", "307", "303AB", "302AB", "402AB", "403AB", "404AB",
    "305AB Phy LAB", "LAB 401", "LAB 403", "LAB 404", "LAB 405", "LAB 406", "LAB 407",
    "Library", "Library 2nd FL", "Conference Hall", "BLUE HALL", "Grey Hall",
    "Green Hall", "Prerecorded",
]
TEACHERS = ["M. Eshkobilova", "L. Nazarova", "I. Khajiev", "F. Makhkamov",
            "A. Yarbekov", "Kh. Khamidulla", "N. Mahamatov", "G. Rakhimova"]
# CYB3-26 haftalik jadval: (kun 0=Du, juftlik, fan, o'qituvchi, xona)
TIMETABLE = [
    (0, 2, "Matematika 1", "M. Eshkobilova", "305"), (0, 3, "Ingliz tili 1", "L. Nazarova", "304"),
    (1, 1, "Matematika 1", "I. Khajiev", "Grey Hall"), (1, 2, "Fizika 1", "F. Makhkamov", "304"),
    (2, 3, "Fizika 1", "A. Yarbekov", "BLUE HALL"),
    (3, 1, "Dasturlash", "Kh. Khamidulla", "LAB 403"), (3, 2, "Dasturlash", "N. Mahamatov", "Green Hall"),
    (3, 3, "PHS", "G. Rakhimova", "Grey Hall"), (3, 4, "NHU", "G. Rakhimova", "Grey Hall"),
    (4, 1, "Matematika 1", "M. Eshkobilova", "307"), (4, 2, "Dasturlash", "Kh. Khamidulla", "LAB 403"),
    (4, 3, "Dasturlash", "N. Mahamatov", "Grey Hall"),
    (5, 2, "Ingliz tili 1", "L. Nazarova", "304"), (5, 7, "NHU", "G. Rakhimova", "Prerecorded"),
    (5, 8, "PHS", "G. Rakhimova", "Prerecorded"),
]
SLOT_START = {1: (9, 0), 2: (10, 30), 3: (12, 0), 4: (14, 20), 5: (15, 50),
              6: (17, 20), 7: (18, 50), 8: (20, 20)}

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
        teachers = {}
        for i, tname in enumerate(TEACHERS):
            phone = f"+99890000010{i}"
            t, _ = await get_or_create(
                db, User, User.phone == phone,
                full_name=tname, phone=phone, role=Role.teacher.value, is_demo=True,
            )
            teachers[tname] = t
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

        # --- boshqa guruhlar: 20 tadan tasodifiy talaba ---
        import random
        rnd = random.Random(2026)
        for gi, code in enumerate(c for c in GROUPS if c != MAIN_GROUP):
            for i in range(20):
                phone = f"+9989001{gi}{i:03d}"
                _, created = await get_or_create(
                    db, User, User.phone == phone,
                    full_name=f"{rnd.choice(LAST)} {rnd.choice(FIRST)}", phone=phone,
                    role=Role.student.value, group_id=groups[code].id, is_demo=True,
                )
                made += int(created)

        # --- bugungi darslar (haftalik jadvaldan) ---
        now = dt.datetime.now(settings.tzinfo)
        day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        plan = [
            (pair, subj, room, SLOT_START[pair][0], SLOT_START[pair][1], tch)
            for (wd, pair, subj, tch, room) in TIMETABLE if wd == now.weekday()
        ] or [(1, SUBJECTS[3], "LAB 403", 9, 0, TEACHERS[5])]   # yakshanba: demo dars
        lessons = 0
        for pair_no, subject, room, h, m, tname in plan:
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
                room_id=rooms[room].id, teacher_id=teachers[tname].id, pair_no=pair_no,
                starts_at=starts, ends_at=starts + dt.timedelta(minutes=80),
                status=LessonStatus.planned.value,
            ))
            lessons += 1

        await db.commit()

        base = settings.base_url.rstrip("/")
        print(f"""
✅ Demo ma'lumot tayyor

   O'qituvchilar: {', '.join(TEACHERS)}
   Starosta   : {starosta.full_name}  ({MAIN_GROUP})
   Talabalar  : +{made} ta (jami {len(STUDENTS)})
   Darslar    : +{lessons} ta (bugun)
   Xonalar    : {len(ROOMS)} ta — {LAT}, {LNG}

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
