from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class RoomStatus(str, Enum):
    waiting = "waiting"
    connected = "connected"
    routine_selected = "routine_selected"
    calibrating = "calibrating"
    active = "active"
    paused = "paused"
    rest = "rest"
    complete = "complete"
    expired = "expired"
    ended = "ended"


class ControllerMode(str, Enum):
    guest = "guest"


class RoomCommandType(str, Enum):
    start_calibration = "START_CALIBRATION"
    start_session = "START_SESSION"
    begin_active_session = "BEGIN_ACTIVE_SESSION"
    pause_session = "PAUSE_SESSION"
    resume_session = "RESUME_SESSION"
    next_stretch = "NEXT_STRETCH"
    skip_stretch = "SKIP_STRETCH"
    end_session = "END_SESSION"
    start_another_quest = "START_ANOTHER_QUEST"


class RoutineSummary(BaseModel):
    id: str
    name: str
    duration_seconds: int
    stretches: list[str]
    description: str


QUICK_RESET_ROUTINE = RoutineSummary(
    id="quick-reset",
    name="Quick Reset",
    duration_seconds=180,
    stretches=[
        "Neck reset",
        "Shoulder opener",
        "Standing side bend",
        "Hamstring reach",
    ],
    description="A short stretch quest for study or desk breaks.",
)

MEME_MODE_ROUTINE = RoutineSummary(
    id="meme-mode",
    name="Meme Mode",
    duration_seconds=160,
    stretches=[
        "Victory pose",
        "T-rex arms",
        "Disco point",
        "Robot freeze",
    ],
    description="A playful pose quest with weird little moves instead of real stretches.",
)

SUPPORTED_ROUTINES: dict[str, RoutineSummary] = {
    QUICK_RESET_ROUTINE.id: QUICK_RESET_ROUTINE,
    MEME_MODE_ROUTINE.id: MEME_MODE_ROUTINE,
}


class JoinRoomRequest(BaseModel):
    mode: str


class SelectRoutineRequest(BaseModel):
    routine_id: str


class RoomCommandRequest(BaseModel):
    type: str


class RoutineListResponse(BaseModel):
    routines: list[RoutineSummary]


class RoomSessionSegmentResponse(BaseModel):
    name: str
    score: int
    stars: int
    feedback_tags: list[str] = Field(default_factory=list)


class RoomSessionResponse(BaseModel):
    id: str
    state: str
    current_index: int
    current_name: str | None = None
    total_stretches: int
    total_score: int
    xp_earned: int
    current_stars: int
    total_stars: int
    elapsed_seconds: int
    feedback_message: str
    started_at: datetime
    completed_at: datetime | None = None
    segments: list[RoomSessionSegmentResponse] = Field(default_factory=list)


class RoomResponse(BaseModel):
    code: str
    status: RoomStatus
    join_path: str
    display_path: str
    expires_at: datetime
    selected_routine: RoutineSummary | None = None
    session: RoomSessionResponse | None = None
    controller_mode: ControllerMode | None = None
    skipped_segments: list[str] = Field(default_factory=list)


class RoomEvent(BaseModel):
    type: str
    room: RoomResponse | None = None
    message: str | None = None


@dataclass
class RoomRecord:
    code: str
    status: RoomStatus
    created_at: datetime
    updated_at: datetime
    expires_at: datetime
    controller_mode: ControllerMode | None = None
    selected_routine_id: str | None = None
    session_id: str | None = None
    skipped_segments: list[str] = field(default_factory=list)
    elapsed_seconds: int = 0
    timer_started_at: datetime | None = None
    last_command_type: str | None = None
    last_command_at: datetime | None = None
