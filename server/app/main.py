from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .routers.health import router as health_router
from .routers.state import router as state_router

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0", description="Shared persistence and audit API for the Site Coverage application.")

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET","PUT","POST","OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(health_router)
app.include_router(state_router)
