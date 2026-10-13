import datetime as dt
import enum
import uuid
from typing import Optional

from sqlalchemy import (
    JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer,
    LargeBinary, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB

# Postgresda JSONB, testlarda (SQLite) oddiy JSON
JSONType = JSON().with_variant(JSONB, "postgresql")
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def aware(value: Optional[dt.datetime]) -> Optional[dt.datetime]:
    """Bazadan kelgan sanani har doim timezone-aware qiladi.

    Postgres tz ni saqlaydi, SQLite (testlar) yo'q — solishtirishda xato
    bermasligi uchun.
    """
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=dt.timezone.utc)


def new_token(n: int = 10) -> str:
    return uuid.uuid4().hex[:n]


class Role(str, enum.Enum):
    super_admin = "super_admin"
    teacher = "teacher"
    starosta = "starosta"
    student = "student"


class LessonStatus(str, enum.Enum):
    planned = "planned"
    open = "open"
    closed = "closed"


class AttStatus(str, enum.Enum):
    present = "present"
    late = "late"
    excused = "excused"
    absent = "absent"
    rejected = "rejected"


# --------------------------------------------------------------- tuzilma

class Faculty(Base):
    __tablename__ = "faculties"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    code: Mapped[str] = mapped_column(String(16), unique=True)

    groups: Mapped[list["Group"]] = relationship(back_populates="faculty")


class Group(Base):
    __tablename__ = "groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # CYB3-26
    faculty_id: Mapped[Optional[int]] = mapped_column(ForeignKey("faculties.id"))
    year: Mapped[Optional[int]] = mapped_column(Integer)
    invite_token: Mapped[str] = mapped_column(String(32), unique=True, default=new_token)
    starosta_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    faculty: Mapped[Optional[Faculty]] = relationship(back_populates="groups")
    students: Mapped[list["User"]] = relationship(
        back_populates="group", foreign_keys="User.group_id"
    )
    starosta: Mapped[Optional["User"]] = relationship(foreign_keys=[starosta_id])


class Room(Base):
    __tablename__ = "rooms"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64))           # A-301
    building: Mapped[Optional[str]] = mapped_column(String(64))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    radius_m: Mapped[int] = mapped_column(Integer, default=120)


class Subject(Base):
    __tablename__ = "subjects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    code: Mapped[Optional[str]] = mapped_column(String(32))


# ------------------------------------------------------------ odamlar

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(128))
    phone: Mapped[Optional[str]] = mapped_column(String(32), unique=True, index=True)
    telegram_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, unique=True, index=True
    )
    username: Mapped[Optional[str]] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(16), default=Role.student.value, index=True)
    group_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Faqat test rejimi uchun yaratilgan hisob. /demo orqali kirish faqat
    # shunday hisoblarga ruxsat etiladi.
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    enrolled_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    group: Mapped[Optional[Group]] = relationship(
        back_populates="students", foreign_keys=[group_id]
    )
    credentials: Mapped[list["Credential"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    faces: Mapped[list["FaceTemplate"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def is_staff(self) -> bool:
        return self.role in (Role.super_admin.value, Role.teacher.value,
                             Role.starosta.value)

    @property
    def short_name(self) -> str:
        parts = self.full_name.split()
        if len(parts) >= 2:
            return f"{parts[0]} {parts[1][0]}."
        return self.full_name


class TeacherGroup(Base):
    __tablename__ = "teacher_groups"
    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    group_id: Mapped[int] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True
    )


# ------------------------------------------------------- biometrika

class Credential(Base):
    """WebAuthn passkey — qurilmaning o'z Face ID / Touch ID si."""
    __tablename__ = "credentials"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    credential_id: Mapped[bytes] = mapped_column(LargeBinary, unique=True)
    public_key: Mapped[bytes] = mapped_column(LargeBinary)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    device_label: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    last_used_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="credentials")


class FaceTemplate(Base):
    """Yuz izi (embedding). Rasm saqlanmaydi — faqat 512 ta son."""
    __tablename__ = "face_templates"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    embedding: Mapped[bytes] = mapped_column(LargeBinary)   # float32 x 512
    quality: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped[User] = relationship(back_populates="faces")


# ---------------------------------------------------------- darslar

class Lesson(Base):
    __tablename__ = "lessons"
    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), index=True)
    subject_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subjects.id"))
    teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"))
    pair_no: Mapped[Optional[int]] = mapped_column(Integer)
    starts_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16), default=LessonStatus.planned.value)

    group: Mapped[Group] = relationship()
    subject: Mapped[Optional[Subject]] = relationship()
    teacher: Mapped[Optional[User]] = relationship(foreign_keys=[teacher_id])
    room: Mapped[Optional[Room]] = relationship()
    session: Mapped[Optional["LessonSession"]] = relationship(
        back_populates="lesson", uselist=False, cascade="all, delete-orphan"
    )


class LessonSession(Base):
    """Davomat oynasi — QR shu sessiya siri bilan imzolanadi."""
    __tablename__ = "lesson_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), unique=True
    )
    secret: Mapped[str] = mapped_column(String(64), default=lambda: uuid.uuid4().hex)
    opened_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    closes_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    geofence_radius_m: Mapped[int] = mapped_column(Integer, default=120)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)

    lesson: Mapped[Lesson] = relationship(back_populates="session")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (
        UniqueConstraint("lesson_id", "user_id", name="uq_attendance_lesson_user"),
        Index("ix_attendance_device", "lesson_id", "device_hash"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(16), default=AttStatus.present.value)
    method: Mapped[Optional[str]] = mapped_column(String(16))   # passkey | face | manual
    marked_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lng: Mapped[Optional[float]] = mapped_column(Float)
    distance_m: Mapped[Optional[float]] = mapped_column(Float)
    accuracy_m: Mapped[Optional[float]] = mapped_column(Float)
    device_hash: Mapped[Optional[str]] = mapped_column(String(64))
    ip: Mapped[Optional[str]] = mapped_column(String(64))
    reason: Mapped[Optional[str]] = mapped_column(Text)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[Optional[str]] = mapped_column(String(128))
    reviewed_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    lesson: Mapped[Lesson] = relationship()


# ------------------------------------------------------------ xizmat

class LoginToken(Base):
    """Bot → sayt bir martalik ko'prigi."""
    __tablename__ = "login_tokens"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    lesson_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lessons.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(32), index=True)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    reason: Mapped[Optional[str]] = mapped_column(String(128))
    ip: Mapped[Optional[str]] = mapped_column(String(64))
    device_hash: Mapped[Optional[str]] = mapped_column(String(64))
    meta: Mapped[Optional[dict]] = mapped_column(JSONType)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, index=True
    )
