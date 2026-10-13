"""Telegram ko'prigi — ro'yxatdan o'tish va saytga qaytish.

Xuddi shu PostgreSQL bazasiga ulanadi (app.models).
"""
import asyncio
import datetime as dt
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from aiogram import Bot, Dispatcher, F  # noqa: E402
from aiogram.client.default import DefaultBotProperties  # noqa: E402
from aiogram.enums import ParseMode  # noqa: E402
from aiogram.filters import Command, CommandObject, CommandStart  # noqa: E402
from aiogram.fsm.context import FSMContext  # noqa: E402
from aiogram.fsm.state import State, StatesGroup  # noqa: E402
from aiogram.fsm.storage.memory import MemoryStorage  # noqa: E402
from aiogram.types import (  # noqa: E402
    InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, Message,
    ReplyKeyboardMarkup, ReplyKeyboardRemove,
)
from sqlalchemy import select  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Group, LoginToken, Role, StaffInvite, User, aware, now_utc,
)
from app.security import random_token  # noqa: E402

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s | %(levelname)-7s | %(message)s")
log = logging.getLogger("bot")


class Reg(StatesGroup):
    full_name = State()
    phone = State()


ROLE_UZ = {
    Role.teacher.value: "o'qituvchi",
    Role.starosta.value: "starosta",
    Role.student.value: "talaba",
}


def phone_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Telefon raqamni yuborish",
                                  request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True,
    )


async def make_login_link(db, user: User) -> str:
    token = random_token(24)
    db.add(LoginToken(
        token=token, user_id=user.id,
        expires_at=now_utc() + dt.timedelta(minutes=10),
    ))
    await db.commit()
    return f"{settings.base_url.rstrip('/')}/auth/{token}"


def site_kb(url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🌐 Saytga qaytish", url=url)]
    ])


dp = Dispatcher(storage=MemoryStorage())


@dp.message(CommandStart(deep_link=True))
async def start_deep(message: Message, command: CommandObject, state: FSMContext):
    payload = (command.args or "").strip()

    if payload.startswith("t_"):
        await start_staff(message, state, payload[2:])
        return
    if not payload.startswith("g_"):
        await start_plain(message, state)
        return

    invite = payload[2:]
    async with SessionLocal() as db:
        group = await db.scalar(
            select(Group).where(Group.invite_token == invite, Group.is_active.is_(True))
        )
        if not group:
            await message.answer("❌ Taklif havolasi yaroqsiz. Starostangizdan yangisini so'rang.")
            return

        user = await db.scalar(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        if user and user.full_name and user.phone:
            user.group_id = group.id
            link = await make_login_link(db, user)
            await message.answer(
                f"✅ Siz <b>{group.code}</b> guruhiga biriktirildingiz.\n"
                f"Saytga o'tib davom eting:",
                reply_markup=site_kb(link),
            )
            return

    await state.set_state(Reg.full_name)
    await state.update_data(group_id=group.id, group_code=group.code,
                            role=Role.student.value, invite_token=None)
    await message.answer(
        f"👋 Assalomu alaykum!\n\n"
        f"<b>{group.code}</b> guruhi davomat tizimiga ro'yxatdan o'tyapsiz.\n\n"
        f"<b>Ism va familiyangizni</b> to'liq yozing.\n"
        f"<i>Masalan: Mamatqulov Zafar</i>",
        reply_markup=ReplyKeyboardRemove(),
    )


async def start_staff(message: Message, state: FSMContext, token: str):
    """O'qituvchi / starosta taklif havolasi."""
    async with SessionLocal() as db:
        inv = await db.scalar(select(StaffInvite).where(StaffInvite.token == token))
        if not inv or inv.used_at is not None or aware(inv.expires_at) < now_utc():
            await message.answer(
                "❌ Taklif havolasi yaroqsiz yoki ishlatib bo'lingan.\n"
                "Administratordan yangisini so'rang."
            )
            return

        group = await db.get(Group, inv.group_id) if inv.group_id else None
        user = await db.scalar(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        if user and user.full_name and user.phone:
            user.role = inv.role
            if inv.group_id:
                user.group_id = inv.group_id
                if inv.role == Role.starosta.value and group:
                    group.starosta_id = user.id
            inv.used_by, inv.used_at = user.id, now_utc()
            link = await make_login_link(db, user)
            await message.answer(
                f"✅ Sizga <b>{ROLE_UZ.get(inv.role, inv.role)}</b> huquqi berildi."
                + (f"\n👥 Guruh: <b>{group.code}</b>" if group else ""),
                reply_markup=site_kb(link),
            )
            return

    await state.set_state(Reg.full_name)
    await state.update_data(
        group_id=inv.group_id,
        group_code=group.code if group else None,
        role=inv.role,
        invite_token=token,
    )
    await message.answer(
        f"👋 Assalomu alaykum!\n\n"
        f"Siz <b>{ROLE_UZ.get(inv.role, inv.role)}</b> sifatida ro'yxatdan o'tyapsiz"
        + (f" ({group.code})" if group else "") + ".\n\n"
        f"<b>Ism va familiyangizni</b> to'liq yozing.\n"
        f"<i>Masalan: Olimov Jahongir</i>",
        reply_markup=ReplyKeyboardRemove(),
    )


@dp.message(CommandStart())
async def start_plain(message: Message, state: FSMContext):
    await state.clear()
    async with SessionLocal() as db:
        user = await db.scalar(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        if not user:
            await message.answer(
                "👋 Salom!\n\nBu <b>Attendly</b> — davomat tizimi boti.\n\n"
                "Ro'yxatdan o'tish uchun starostangiz bergan <b>guruh havolasi</b> kerak. "
                "Havolani oching va u sizni shu yerga qaytaradi."
            )
            return
        link = await make_login_link(db, user)
    await message.answer(
        f"Salom, <b>{user.full_name}</b>!\nSaytga o'tish uchun tugmani bosing:",
        reply_markup=site_kb(link),
    )


@dp.message(Reg.full_name, F.text)
async def reg_name(message: Message, state: FSMContext):
    name = " ".join(message.text.split())
    if len(name) < 5 or len(name) > 64 or not any(c.isalpha() for c in name):
        await message.answer("Ism-familiyani to'liq yozing (kamida 5 belgi):")
        return
    await state.update_data(full_name=name)
    await state.set_state(Reg.phone)
    await message.answer(
        f"Rahmat, <b>{name}</b>.\n\n"
        f"Endi telefon raqamingizni yuboring — pastdagi tugmani bosing.\n"
        f"<i>Raqam Telegram akkauntingizdan olinadi, qo'lda yozilmaydi.</i>",
        reply_markup=phone_kb(),
    )


@dp.message(Reg.phone, F.contact)
async def reg_phone(message: Message, state: FSMContext):
    contact = message.contact
    if contact.user_id != message.from_user.id:
        await message.answer(
            "❌ Bu raqam sizniki emas. O'z raqamingizni tugma orqali yuboring.",
            reply_markup=phone_kb(),
        )
        return

    data = await state.get_data()
    phone = contact.phone_number if contact.phone_number.startswith("+") \
        else "+" + contact.phone_number

    async with SessionLocal() as db:
        dup = await db.scalar(
            select(User).where(User.phone == phone,
                               User.telegram_id != message.from_user.id)
        )
        if dup:
            await message.answer(
                "❌ Bu raqam allaqachon boshqa hisobga biriktirilgan.",
                reply_markup=ReplyKeyboardRemove(),
            )
            await state.clear()
            return

        role = data.get("role") or Role.student.value
        invite_token = data.get("invite_token")

        # Taklif havolasini qayta tekshiramiz — oraliqda ishlatilgan bo'lishi mumkin
        inv = None
        if invite_token:
            inv = await db.scalar(
                select(StaffInvite).where(StaffInvite.token == invite_token)
            )
            if not inv or inv.used_at is not None or aware(inv.expires_at) < now_utc():
                await message.answer(
                    "❌ Taklif havolasi ishlatib bo'lingan yoki eskirgan.",
                    reply_markup=ReplyKeyboardRemove(),
                )
                await state.clear()
                return
            role = inv.role

        if message.from_user.id in settings.admin_ids:
            role = Role.super_admin.value

        user = await db.scalar(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        if user:
            user.full_name = data["full_name"]
            user.phone = phone
            user.group_id = data["group_id"]
            user.username = message.from_user.username
            user.role = role
        else:
            user = User(
                full_name=data["full_name"], phone=phone,
                telegram_id=message.from_user.id,
                username=message.from_user.username,
                role=role, group_id=data["group_id"],
            )
            db.add(user)
        await db.flush()

        if inv:
            inv.used_by, inv.used_at = user.id, now_utc()
            if inv.role == Role.starosta.value and inv.group_id:
                group = await db.get(Group, inv.group_id)
                if group:
                    group.starosta_id = user.id

        await db.commit()
        await db.refresh(user)
        link = await make_login_link(db, user)

    await state.clear()
    lines = [
        "✅ Ro'yxatdan o'tdingiz!\n",
        f"👤 {data['full_name']}",
        f"🎓 {ROLE_UZ.get(role, role)}",
    ]
    if data.get("group_code"):
        lines.append(f"👥 {data['group_code']}")
    lines.append(f"📱 {phone}")

    if role == Role.student.value:
        lines.append(
            "\nEndi saytga o'tib <b>shaxsingizni biriktiring</b> — Face ID va "
            "yuz skaneri. Bu bir martalik amal."
        )
    else:
        lines.append("\nSaytga o'tib panelingizni oching.")

    await message.answer("\n".join(lines), reply_markup=ReplyKeyboardRemove())
    await message.answer("Quyidagi tugma orqali o'ting 👇", reply_markup=site_kb(link))


@dp.message(Reg.phone)
async def reg_phone_wrong(message: Message):
    await message.answer(
        "Telefon raqamni <b>tugma orqali</b> yuboring — qo'lda yozilgan raqam "
        "qabul qilinmaydi.",
        reply_markup=phone_kb(),
    )


@dp.message(Command("sayt"))
async def cmd_site(message: Message):
    async with SessionLocal() as db:
        user = await db.scalar(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        if not user:
            await message.answer("Avval ro'yxatdan o'ting — /start")
            return
        link = await make_login_link(db, user)
    await message.answer("Saytga kirish havolasi (10 daqiqa amal qiladi):",
                         reply_markup=site_kb(link))


@dp.message(Command("id"))
async def cmd_id(message: Message):
    await message.answer(f"Telegram ID: <code>{message.from_user.id}</code>")


async def main():
    if not settings.bot_token:
        sys.exit("BOT_TOKEN topilmadi — .env ni to'ldiring")
    bot = Bot(settings.bot_token,
              default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    me = await bot.get_me()
    log.info("Bot ishga tushdi: @%s", me.username)
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        log.info("To'xtatildi")
