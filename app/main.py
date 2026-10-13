import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import face_engine
from app.config import settings
from app.db import init_models
from app.routers import admin, attend, auth, demo, enroll, pages, teacher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
log = logging.getLogger("attendly")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.secret_key == "dev-secret-change-me" and not settings.is_local:
        raise RuntimeError(
            "SECRET_KEY o'zgartirilmagan — produksiyada ishga tushmaydi. "
            "openssl rand -hex 32 bilan yangi kalit yarating."
        )
    await init_models()
    log.info("%s ishga tushdi — %s", settings.app_name, settings.base_url)
    log.info("WebAuthn RP ID: %s", settings.rp_id)
    log.info("Yuz tanish: %s", face_engine.status())
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan, docs_url="/api/docs")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(pages.router)
app.include_router(auth.router)
app.include_router(enroll.router)
app.include_router(attend.router)
app.include_router(teacher.router)
app.include_router(admin.router)

if settings.demo_mode:
    app.include_router(demo.router)
    log.warning(
        "⚠️  TEST REJIMI YOQILGAN — /demo orqali parolsiz kirish ochiq. "
        "Geofence: %s, Biometrika: %s. Produksiyada DEMO_MODE=false qiling.",
        "O'CHIQ" if settings.demo_skip_geofence else "tekshiriladi",
        "O'CHIQ" if settings.demo_skip_biometry else "tekshiriladi",
    )


@app.get("/healthz")
async def healthz():
    return {"ok": True, "face": face_engine.status()}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "camera=(self), geolocation=(self)"
    return resp


@app.exception_handler(500)
async def on_error(request: Request, exc: Exception):
    log.exception("Server xatosi: %s", request.url.path)
    return JSONResponse({"detail": "Server xatosi"}, status_code=500)
