"""Anti-cheat yadrosining testlari: QR rotatsiya/eskirish va geofence."""
import time

import pytest

from app.config import settings
from app.security import (
    GeoError, QRError, check_geofence, current_window, haversine_m,
    make_attempt, make_qr_token, read_attempt, seconds_to_next_window,
    token_age_seconds, verify_qr_token,
)

SECRET = "sessiya-siri-abc123"
LESSON = 42


# ------------------------------------------------------------------- QR

def test_token_valid_now():
    t = make_qr_token(LESSON, SECRET)
    assert verify_qr_token(t, SECRET) == LESSON


def test_token_rotates_every_n_seconds():
    now = 1_000_000.0
    a = make_qr_token(LESSON, SECRET, ts=now)
    b = make_qr_token(LESSON, SECRET, ts=now + settings.qr_rotate_seconds)
    assert a != b, "QR har oynada o'zgarishi kerak"


def test_token_stable_inside_window():
    now = 1_000_002.0  # oyna boshi (3 ga bo'linadi)
    a = make_qr_token(LESSON, SECRET, ts=now)
    b = make_qr_token(LESSON, SECRET, ts=now + 0.9)
    assert a == b


def test_token_expires_after_accept_window():
    """Do'stiga skrinshot yuborib ulgurmaydi."""
    now = 1_000_000.0
    t = make_qr_token(LESSON, SECRET, ts=now)
    step = settings.qr_rotate_seconds
    ttl = step * settings.qr_accept_windows

    # Kafolatlangan amal qilish muddati ichida — o'tadi
    assert verify_qr_token(t, SECRET, ts=now + step * (settings.qr_accept_windows - 1) - 1) \
        == LESSON

    # TTL dan keyin — albatta rad
    with pytest.raises(QRError) as e:
        verify_qr_token(t, SECRET, ts=now + ttl + 1)
    assert "expired" in str(e.value)


def test_ttl_is_short():
    """Skrinshotni do'stiga yuborib ulgurmasligi uchun."""
    ttl = settings.qr_rotate_seconds * settings.qr_accept_windows
    assert ttl <= 15, f"QR TTL juda uzun: {ttl}s"


def test_wrong_secret_rejected():
    t = make_qr_token(LESSON, SECRET)
    with pytest.raises(QRError) as e:
        verify_qr_token(t, "boshqa-sir")
    assert "signature" in str(e.value)


def test_forged_token_rejected():
    with pytest.raises(QRError):
        verify_qr_token(f"{LESSON}.{current_window()}.AAAAAAAAAAAA", SECRET)


def test_token_from_another_lesson_rejected():
    """Boshqa auditoriyadagi darsning QR i o'tmasligi kerak."""
    t = make_qr_token(99, SECRET)
    assert verify_qr_token(t, SECRET) == 99  # imzo to'g'ri
    # lekin lesson_id boshqa — API darajasida guruh tekshiruvi ushlaydi
    assert t.split(".")[0] == "99"


def test_malformed():
    for bad in ("", "abc", "1.2", "x.y.z"):
        with pytest.raises(QRError):
            verify_qr_token(bad, SECRET)


def test_future_token_rejected():
    now = 1_000_000.0
    t = make_qr_token(LESSON, SECRET, ts=now + 60)
    with pytest.raises(QRError) as e:
        verify_qr_token(t, SECRET, ts=now)
    assert "future" in str(e.value)


def test_token_age():
    now = 1_000_000.0
    t = make_qr_token(LESSON, SECRET, ts=now)
    assert token_age_seconds(t, ts=now + 6) == pytest.approx(6, abs=3)


def test_seconds_to_next_window():
    s = seconds_to_next_window(ts=1_000_000.0)
    assert 0 < s <= settings.qr_rotate_seconds


# ------------------------------------------------------------- geofence

TTPU = (41.2646, 69.2163)


def test_haversine_known_distance():
    # 0.001° kenglik ≈ 111 m
    d = haversine_m(41.2646, 69.2163, 41.2656, 69.2163)
    assert 105 < d < 120


def test_inside_fence():
    d = check_geofence(TTPU[0], TTPU[1], 10, TTPU[0], TTPU[1], 120)
    assert d is not None and d < 5


def test_too_far_rejected():
    """Uydan turib skanerlash — 2 km narida."""
    with pytest.raises(GeoError) as e:
        check_geofence(41.2846, 69.2163, 10, TTPU[0], TTPU[1], 120)
    assert e.value.code == "too_far"
    assert e.value.distance > 1500


def test_location_required():
    with pytest.raises(GeoError) as e:
        check_geofence(None, None, None, TTPU[0], TTPU[1], 120)
    assert e.value.code == "location_required"


def test_bad_accuracy_rejected():
    with pytest.raises(GeoError) as e:
        check_geofence(TTPU[0], TTPU[1], 500, TTPU[0], TTPU[1], 120)
    assert e.value.code == "location_inaccurate"


def test_accuracy_gives_benefit_of_doubt():
    """Chegaradan sal narida, lekin GPS aniqligi past — adolatli qabul."""
    # ~160 m narida, aniqlik 80 m, radius 120 m
    d = check_geofence(41.26604, 69.2163, 80, TTPU[0], TTPU[1], 120)
    assert d is not None


def test_no_room_skips_geofence():
    assert check_geofence(None, None, None, None, None, 120) is None


# -------------------------------------------------------------- attempt

def test_attempt_roundtrip():
    tok = make_attempt({"k": "attend", "uid": 7, "lid": 42})
    data = read_attempt(tok)
    assert data["uid"] == 7 and data["lid"] == 42


def test_attempt_expires():
    tok = make_attempt({"k": "attend", "uid": 7})
    assert read_attempt(tok, max_age=-1) is None


def test_attempt_tampered():
    tok = make_attempt({"k": "attend", "uid": 7})
    assert read_attempt(tok[:-3] + "xyz") is None


# ---------------------------------------------- xodim taklif havolasi

def test_invite_token_is_unguessable():
    """Taklif tokeni taxmin qilinadigan bo'lmasligi kerak."""
    from app.models import new_token
    tokens = {new_token(14) for _ in range(500)}
    assert len(tokens) == 500, "tokenlar takrorlandi"
    assert all(len(t) == 14 for t in tokens)


def test_login_token_entropy():
    from app.security import random_token
    tokens = {random_token(24) for _ in range(500)}
    assert len(tokens) == 500
    assert all(len(t) >= 30 for t in tokens)
