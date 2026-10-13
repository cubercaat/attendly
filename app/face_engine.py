"""Yuz tanish — passkey ishlamagan holat uchun zaxira yo'l.

Rasm SAQLANMAYDI. Faqat 512 o'lchamli embedding (float32) bazaga yoziladi,
undan rasmni tiklab bo'lmaydi.

InsightFace o'rnatilmagan bo'lsa modul "o'chiq" holatda ishlaydi va tizim
faqat passkey bilan davom etadi.
"""
from __future__ import annotations

import base64
import io
import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np

from app.config import settings

log = logging.getLogger("face")

_app = None
_load_error: Optional[str] = None


def _loader():
    global _app, _load_error
    if _app is not None or _load_error is not None:
        return _app
    try:
        from insightface.app import FaceAnalysis  # type: ignore

        a = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        a.prepare(ctx_id=-1, det_size=(640, 640))
        _app = a
        log.info("InsightFace yuklandi")
    except Exception as e:  # noqa: BLE001
        _load_error = str(e)
        log.warning("Yuz tanish o'chiq: %s", e)
    return _app


def available() -> bool:
    return settings.face_enabled and _loader() is not None


def status() -> dict:
    return {
        "enabled": settings.face_enabled,
        "loaded": _app is not None,
        "error": _load_error,
        "threshold": settings.face_match_threshold,
        "min_frames": settings.face_min_frames,
    }


# ----------------------------------------------------------------- yordamchi

def _decode(data_url: str) -> "np.ndarray":
    """data:image/jpeg;base64,... → RGB numpy massiv."""
    from PIL import Image

    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)


def pack(vec: "np.ndarray") -> bytes:
    return np.asarray(vec, dtype=np.float32).tobytes()


def unpack(blob: bytes) -> "np.ndarray":
    return np.frombuffer(blob, dtype=np.float32)


def cosine_distance(a: "np.ndarray", b: "np.ndarray") -> float:
    a = a / (np.linalg.norm(a) + 1e-9)
    b = b / (np.linalg.norm(b) + 1e-9)
    return float(1.0 - np.dot(a, b))


@dataclass
class FaceRead:
    embedding: "np.ndarray"
    det_score: float
    yaw: float          # bosh burilishi: manfiy = chap, musbat = o'ng
    pitch: float
    bbox_area: float


class FaceError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def read_face(data_url: str) -> FaceRead:
    app = _loader()
    if app is None:
        raise FaceError("face_engine_unavailable")

    img = _decode(data_url)
    faces = app.get(img)
    if not faces:
        raise FaceError("no_face")
    if len(faces) > 1:
        raise FaceError("multiple_faces")

    f = faces[0]
    x1, y1, x2, y2 = f.bbox
    area = float((x2 - x1) * (y2 - y1)) / float(img.shape[0] * img.shape[1])
    if area < 0.02:
        raise FaceError("face_too_small")

    pose = getattr(f, "pose", None)
    pitch = float(pose[0]) if pose is not None else 0.0
    yaw = float(pose[1]) if pose is not None else 0.0

    return FaceRead(
        embedding=np.asarray(f.normed_embedding, dtype=np.float32),
        det_score=float(f.det_score),
        yaw=yaw,
        pitch=pitch,
        bbox_area=area,
    )


# ------------------------------------------------------------- liveness
#
# To'liq anti-spoofing emas, lekin "do'stining rasmini ko'rsatish" ni to'sadi:
# server tasodifiy ketma-ketlik beradi (markaz → chap → o'ng), har kadrda bosh
# burchagi tekshiriladi va kadrlar bir-biridan farq qilishi shart.

CHALLENGES = ["center", "left", "right"]
YAW_MIN = 15.0


def challenge_ok(kind: str, read: FaceRead) -> bool:
    if kind == "center":
        return abs(read.yaw) < 12.0
    if kind == "left":
        return read.yaw < -YAW_MIN
    if kind == "right":
        return read.yaw > YAW_MIN
    return False


def frames_are_distinct(reads: list[FaceRead]) -> bool:
    """Bir xil rasm qayta-qayta yuborilganini ushlaydi."""
    for i in range(len(reads) - 1):
        d = cosine_distance(reads[i].embedding, reads[i + 1].embedding)
        if d < 0.005:
            return False
    return True


def average_embedding(reads: list[FaceRead]) -> "np.ndarray":
    m = np.mean([r.embedding for r in reads], axis=0)
    return (m / (np.linalg.norm(m) + 1e-9)).astype(np.float32)


def match(probe: "np.ndarray", templates: list[bytes]) -> tuple[bool, float]:
    """Eng yaqin shablon bilan solishtiradi."""
    if not templates:
        return False, 1.0
    best = min(cosine_distance(probe, unpack(t)) for t in templates)
    return best <= settings.face_match_threshold, best
