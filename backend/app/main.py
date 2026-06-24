from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, notifications, pose, quests, rooms, sessions
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(rooms.router)
app.include_router(sessions.router)
app.include_router(quests.router)
app.include_router(notifications.router)
app.include_router(pose.router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "message": "YUEDMAI Next backend is running",
    }
