from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class AttendBegin(BaseModel):
    qr_token: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    accuracy: Optional[float] = None
    device: Optional[str] = Field(None, max_length=256)


class PasskeyFinish(BaseModel):
    attempt: str
    credential: dict[str, Any]


class Frame(BaseModel):
    kind: Literal["center", "left", "right"]
    image: str = Field(..., max_length=4_000_000)


class FaceFinish(BaseModel):
    attempt: str
    frames: list[Frame]


class FaceEnroll(BaseModel):
    challenge: str
    frames: list[Frame]


class EnrollPasskeyFinish(BaseModel):
    attempt: str
    credential: dict[str, Any]
    device_label: Optional[str] = Field(None, max_length=64)


class LessonCreate(BaseModel):
    group_id: int
    subject_id: Optional[int] = None
    room_id: Optional[int] = None
    pair_no: Optional[int] = None
    starts_at: Optional[str] = None
    duration_min: int = 80


class OpenSession(BaseModel):
    window_minutes: int = 15
    geofence_radius_m: Optional[int] = None


class ReviewAction(BaseModel):
    attendance_id: int
    action: Literal["reject", "accept", "excuse"]
    reason: Optional[str] = Field(None, max_length=200)


class GroupCreate(BaseModel):
    code: str = Field(..., max_length=32)
    faculty_id: Optional[int] = None
    year: Optional[int] = None


class InviteCreate(BaseModel):
    role: Literal["teacher", "starosta"]
    group_id: Optional[int] = None          # starosta uchun shart
    note: Optional[str] = Field(None, max_length=128)
    days: int = 7


class RoomCreate(BaseModel):
    name: str
    building: Optional[str] = None
    lat: float
    lng: float
    radius_m: int = 120
