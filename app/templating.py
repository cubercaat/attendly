from fastapi.templating import Jinja2Templates

from app.config import settings

templates = Jinja2Templates(directory="app/templates")
templates.env.globals.update(
    app_name=settings.app_name,
    bot_username=settings.bot_username,
    demo_mode=settings.demo_mode,
    demo_skip_geofence=settings.demo_skip_geofence,
    demo_skip_biometry=settings.demo_skip_biometry,
)
