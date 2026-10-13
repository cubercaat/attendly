from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Attendly"
    base_url: str = "http://localhost:8000"
    secret_key: str = "dev-secret-change-me"
    tz: str = "Asia/Tashkent"

    database_url: str = "postgresql+asyncpg://attendly:attendly@localhost:5432/attendly"

    bot_token: str = ""
    bot_username: str = "AttendlyBot"
    super_admin_ids: str = ""

    qr_rotate_seconds: int = 3
    qr_accept_windows: int = 4

    default_geofence_radius_m: int = 120
    max_gps_accuracy_m: int = 100

    face_enabled: bool = True
    face_match_threshold: float = 0.38
    face_min_frames: int = 3

    # ---------------- TEST REJIMI ----------------
    # demo_mode: Telegramsiz kirish sahifasi (/demo) ochiladi.
    #   Faqat is_demo=True foydalanuvchilarga kirish mumkin — haqiqiy
    #   talabaga demo orqali kirib bo'lmaydi.
    # Quyidagi ikkitasi default o'chiq: GPS va biometrika TEKSHIRILADI.
    demo_mode: bool = False
    demo_skip_geofence: bool = False
    demo_skip_biometry: bool = False

    @property
    def tzinfo(self) -> ZoneInfo:
        return ZoneInfo(self.tz)

    @property
    def admin_ids(self) -> set[int]:
        return {
            int(x) for x in self.super_admin_ids.replace(" ", "").split(",")
            if x.strip().isdigit()
        }

    @property
    def rp_id(self) -> str:
        """WebAuthn Relying Party ID — domen (portsiz)."""
        host = self.base_url.split("://", 1)[-1].split("/", 1)[0]
        return host.split(":")[0]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
