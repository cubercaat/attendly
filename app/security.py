"""QR token imzosi, geofence, sessiya cookie, qurilma barmoq izi."""
import base64
import hashlib
import hmac
import math
import secrets
import time
from typing import Optional

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import settings

SESSION_COOKIE = "attendly_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 90  # 90 kun

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="attendly-session")


# ------------------------------------------------------------- sessiya

def make_session(user_id: int) -> str:
    return _serializer.dumps({"uid": user_id})


def read_session(raw: Optional[str]) -> Optional[int]:
    if not raw:
        return None
    try:
        data = _serializer.loads(raw, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid")
    return int(uid) if uid else None


def random_token(n: int = 24) -> str:
    return secrets.token_urlsafe(n)


# ------------------------------------------- qisqa muddatli "attempt" token
# Begin → Finish oralig'ida holatni serverda saqlamaslik uchun: challenge,
# lesson_id, GPS natijasi imzolangan tokenda yuriydi.

_attempt_ser = URLSafeTimedSerializer(settings.secret_key, salt="attendly-attempt")
ATTEMPT_MAX_AGE = 120  # soniya


def make_attempt(payload: dict) -> str:
    return _attempt_ser.dumps(payload)


def read_attempt(token: str, max_age: int = ATTEMPT_MAX_AGE) -> Optional[dict]:
    try:
        return _attempt_ser.loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None


# ------------------------------------------------------------- QR token
#
# Token stateless: imzo sessiya siridan olinadi, server hech narsa saqlamaydi.
#   payload = "<lesson_id>.<window>"
#   window  = unix_time // QR_ROTATE_SECONDS
#   token   = "<lesson_id>.<window>.<sig12>"
#
# Tekshirishda oxirgi QR_ACCEPT_WINDOWS ta oyna qabul qilinadi.
# 3s * 4 = 12 soniya — skanerlash va tarmoq uchun yetarli, skrinshot ulashishga yo'q.

def _sig(secret: str, lesson_id: int, window: int) -> str:
    msg = f"{lesson_id}.{window}".encode()
    digest = hmac.new(secret.encode(), msg, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest)[:12].decode()


def current_window(ts: Optional[float] = None) -> int:
    return int((ts if ts is not None else time.time()) // settings.qr_rotate_seconds)


def make_qr_token(lesson_id: int, secret: str, ts: Optional[float] = None) -> str:
    w = current_window(ts)
    return f"{lesson_id}.{w}.{_sig(secret, lesson_id, w)}"


def seconds_to_next_window(ts: Optional[float] = None) -> float:
    now = ts if ts is not None else time.time()
    step = settings.qr_rotate_seconds
    return step - (now % step)


class QRError(Exception):
    """Token noto'g'ri yoki eskirgan."""


def parse_qr_token(token: str) -> tuple[int, int, str]:
    parts = (token or "").strip().split(".")
    if len(parts) != 3 or not parts[0].isdigit() or not parts[1].isdigit():
        raise QRError("token_malformed")
    return int(parts[0]), int(parts[1]), parts[2]


def verify_qr_token(
    token: str, secret: str, ts: Optional[float] = None
) -> int:
    """Tokenni tekshiradi, lesson_id qaytaradi. Aks holda QRError."""
    lesson_id, window, sig = parse_qr_token(token)
    now_w = current_window(ts)

    if window > now_w:                       # kelajakdagi token
        raise QRError("token_future")
    if now_w - window >= settings.qr_accept_windows:
        raise QRError("token_expired")
    if not hmac.compare_digest(sig, _sig(secret, lesson_id, window)):
        raise QRError("token_bad_signature")
    return lesson_id


def token_age_seconds(token: str, ts: Optional[float] = None) -> float:
    _, window, _ = parse_qr_token(token)
    return (current_window(ts) - window) * settings.qr_rotate_seconds


# ------------------------------------------------------------- geofence

EARTH_R = 6_371_000.0


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R * math.asin(math.sqrt(a))


class GeoError(Exception):
    def __init__(self, code: str, distance: Optional[float] = None):
        super().__init__(code)
        self.code = code
        self.distance = distance


def check_geofence(
    lat: Optional[float], lng: Optional[float], accuracy: Optional[float],
    room_lat: Optional[float], room_lng: Optional[float], radius_m: int,
) -> Optional[float]:
    """Masofani qaytaradi. Xona koordinatasi yo'q bo'lsa tekshiruv o'tkazilmaydi."""
    if room_lat is None or room_lng is None:
        return None
    if lat is None or lng is None:
        raise GeoError("location_required")
    if accuracy is not None and accuracy > settings.max_gps_accuracy_m:
        raise GeoError("location_inaccurate")

    dist = haversine_m(lat, lng, room_lat, room_lng)
    # GPS aniqligini hisobga olamiz — adolatli bo'lishi uchun
    effective = dist - min(accuracy or 0.0, settings.max_gps_accuracy_m)
    if effective > radius_m:
        raise GeoError("too_far", dist)
    return dist


# --------------------------------------------------------- qurilma izi

def device_hash(raw_fingerprint: Optional[str], user_agent: Optional[str]) -> str:
    base = f"{raw_fingerprint or ''}|{user_agent or ''}"
    return hashlib.sha256(base.encode()).hexdigest()[:32]


def client_ip(headers, fallback: Optional[str]) -> Optional[str]:
    fwd = headers.get("x-forwarded-for") if settings.trust_proxy else None
    if fwd:
        return fwd.split(",")[0].strip()
    return fallback
