from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers.ai import router as ai_router
from .routers.health import router as health_router
from .routers.state import router as state_router
from .routers.schedules import router as schedules_router
from .routers.workload import router as workload_router
from .db import SessionLocal
from .services.schedule_seed import seed_schedules

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.3.0",
    description="Shared persistence, audit, workload, and local-AI API for the Site Coverage application.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "PUT", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

app.include_router(health_router)
@app.on_event("startup")
def seed_recurring_schedules() -> None:
    db = SessionLocal()
    try:
        seed_schedules(db)
    finally:
        db.close()


app.include_router(state_router)
app.include_router(schedules_router)
app.include_router(ai_router)
app.include_router(workload_router)
