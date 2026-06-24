from __future__ import annotations

import logging
import random
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from threading import RLock

from fastapi import WebSocket

from app.core.config import settings
from app.models.room import (
    ControllerMode,
    QUICK_RESET_ROUTINE,
    RoomCommandType,
    RoomEvent,
    RoomRecord,
    RoomResponse,
    RoomSessionResponse,
    RoomSessionSegmentResponse,
    RoomStatus,
    RoutineSummary,
    SUPPORTED_ROUTINES,
)
from app.services.session_engine import session_engine

logger = logging.getLogger(__name__)

ROOM_CODE_PATTERN = re.compile(r"^[A-Z0-9]{4,8}$")
ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DEFAULT_ROOM_TTL_SECONDS = 600
COMMAND_DEBOUNCE_SECONDS = 0.4
STALE_ROOM_RETENTION_SECONDS = 3600


class RoomServiceError(Exception):
    """Base error for room operations."""


class RoomValidationError(RoomServiceError):
    """Raised when client input is invalid."""


class RoomNotFoundError(RoomServiceError):
    """Raised when a room code does not exist."""


class RoomExpiredError(RoomServiceError):
    """Raised when a room has expired."""


class RoomConflictError(RoomServiceError):
    """Raised when an operation is invalid for the current room state."""


@dataclass
class RoomSocketGroup:
    display: set[WebSocket] = field(default_factory=set)
    controller: set[WebSocket] = field(default_factory=set)


class RoomService:
    def __init__(self, ttl_seconds: int = DEFAULT_ROOM_TTL_SECONDS) -> None:
        self._ttl = timedelta(seconds=ttl_seconds)
        self._stale_retention = timedelta(seconds=STALE_ROOM_RETENTION_SECONDS)
        self._rooms: dict[str, RoomRecord] = {}
        self._sockets: dict[str, RoomSocketGroup] = {}
        self._lock = RLock()

    def reset(self) -> None:
        with self._lock:
            self._rooms.clear()
            self._sockets.clear()

    def list_routines(self) -> list[RoutineSummary]:
        return list(SUPPORTED_ROUTINES.values())

    def create_room(self) -> RoomResponse:
        with self._lock:
            now = self._now()
            self._prune_locked(now)

            for _ in range(64):
                code = self._generate_room_code()
                if code not in self._rooms:
                    room = RoomRecord(
                        code=code,
                        status=RoomStatus.waiting,
                        created_at=now,
                        updated_at=now,
                        expires_at=now + self._ttl,
                    )
                    self._rooms[code] = room
                    logger.info("Created room %s", code)
                    return self._serialize_room_locked(room, now)

        raise RoomServiceError("Unable to generate a unique room code.")

    def get_room(self, room_code: str) -> RoomResponse:
        with self._lock:
            room = self._get_active_room_locked(room_code)
            return self._serialize_room_locked(room, self._now())

    def join_room(self, room_code: str, mode: str) -> RoomResponse:
        if mode != ControllerMode.guest.value:
            raise RoomValidationError("Only guest mode is supported in this version.")

        with self._lock:
            room = self._get_active_room_locked(room_code)
            if room.controller_mode is not None:
                raise RoomConflictError("A controller is already connected to this room.")

            room.controller_mode = ControllerMode.guest
            room.status = RoomStatus.connected
            self._touch_locked(room)
            return self._serialize_room_locked(room, self._now())

    def select_routine(self, room_code: str, routine_id: str) -> RoomResponse:
        with self._lock:
            room = self._get_active_room_locked(room_code)
            if room.controller_mode is None:
                raise RoomConflictError("Join this room before selecting a routine.")
            if routine_id not in SUPPORTED_ROUTINES:
                raise RoomValidationError("Unsupported routine.")
            if room.status not in {RoomStatus.connected, RoomStatus.routine_selected}:
                raise RoomConflictError("You cannot select a routine right now.")

            room.selected_routine_id = routine_id
            room.status = RoomStatus.routine_selected
            self._touch_locked(room)
            return self._serialize_room_locked(room, self._now())

    def send_command(self, room_code: str, command_type: str) -> RoomResponse:
        command = self._parse_command(command_type)

        with self._lock:
            room = self._get_active_room_locked(room_code)
            self._reject_duplicate_command_locked(room, command.value)

            if command is RoomCommandType.start_calibration:
                self._start_calibration_locked(room)
            elif command is RoomCommandType.start_session:
                self._start_session_locked(room)
            elif command is RoomCommandType.begin_active_session:
                self._begin_active_session_locked(room)
            elif command is RoomCommandType.pause_session:
                self._pause_session_locked(room)
            elif command is RoomCommandType.resume_session:
                self._resume_session_locked(room)
            elif command is RoomCommandType.next_stretch:
                self._advance_session_locked(room, skipped=False)
            elif command is RoomCommandType.skip_stretch:
                self._advance_session_locked(room, skipped=True)
            elif command is RoomCommandType.end_session:
                self._end_session_locked(room)
            elif command is RoomCommandType.start_another_quest:
                self._reset_for_another_quest_locked(room)
            else:
                raise RoomValidationError("Unsupported command.")

            room.last_command_type = command.value
            room.last_command_at = self._now()
            return self._serialize_room_locked(room, self._now())

    async def connect(self, room_code: str, role: str, websocket: WebSocket) -> RoomResponse:
        role_name = self._validate_socket_role(role)

        with self._lock:
            room = self._get_active_room_locked(room_code)
            group = self._sockets.setdefault(room.code, RoomSocketGroup())
            getattr(group, role_name).add(websocket)
            snapshot = self._serialize_room_locked(room, self._now())

        await websocket.accept()
        await websocket.send_json(RoomEvent(type="ROOM_STATE", room=snapshot).model_dump(mode="json"))
        return snapshot

    async def disconnect(self, room_code: str, role: str, websocket: WebSocket) -> bool:
        with self._lock:
            group = self._sockets.get(room_code)
            if group is None:
                return False
            sockets = getattr(group, role, None)
            if sockets is None:
                return False
            sockets.discard(websocket)
            room_reset = False
            if role == "controller" and not group.controller:
                room = self._rooms.get(room_code)
                if room is not None and room.status is not RoomStatus.expired:
                    self._reset_to_waiting_locked(room)
                    room_reset = True
            if not group.display and not group.controller:
                self._sockets.pop(room_code, None)
            return room_reset

    async def broadcast_room(self, room_code: str) -> None:
        with self._lock:
            room = self._rooms.get(room_code)
            if room is None:
                return
            try:
                room = self._get_active_room_locked(room_code)
            except RoomExpiredError:
                room = self._rooms.get(room_code)
                if room is None:
                    return
                payload = RoomEvent(type="ROOM_ERROR", message="This room has expired.")
            else:
                payload = RoomEvent(
                    type="ROOM_UPDATED",
                    room=self._serialize_room_locked(room, self._now()),
                )

            group = self._sockets.get(room_code)
            if group is None:
                return
            targets = list(group.display | group.controller)

        stale: list[WebSocket] = []
        data = payload.model_dump(mode="json")
        for socket in targets:
            try:
                await socket.send_json(data)
            except Exception:
                stale.append(socket)

        if not stale:
            return

        with self._lock:
            group = self._sockets.get(room_code)
            if group is None:
                return
            for socket in stale:
                group.display.discard(socket)
                group.controller.discard(socket)
            if not group.display and not group.controller:
                self._sockets.pop(room_code, None)

    def _start_calibration_locked(self, room: RoomRecord) -> None:
        self._ensure_controller_locked(room)
        self._ensure_routine_locked(room)
        if room.status not in {RoomStatus.connected, RoomStatus.routine_selected}:
            raise RoomConflictError("Calibration can only start after routine selection.")
        room.status = RoomStatus.calibrating
        self._touch_locked(room)

    def _start_session_locked(self, room: RoomRecord) -> None:
        self._ensure_controller_locked(room)
        self._ensure_routine_locked(room)
        if room.status not in {RoomStatus.routine_selected, RoomStatus.calibrating}:
            raise RoomConflictError("The quest cannot start from the current room state.")

        if room.session_id is None:
            routine = SUPPORTED_ROUTINES[room.selected_routine_id]
            session = session_engine.create_session(routine.stretches)
            session.state = "ready"
            room.session_id = session.id
            room.skipped_segments = []
            room.elapsed_seconds = 0
        else:
            session = self._get_room_session_locked(room)
            if session.state == "complete":
                raise RoomConflictError("This room needs a new quest before starting again.")

        room.status = RoomStatus.calibrating
        room.timer_started_at = None
        self._touch_locked(room)

    def _begin_active_session_locked(self, room: RoomRecord) -> None:
        self._ensure_controller_locked(room)
        self._ensure_routine_locked(room)
        if room.status is not RoomStatus.calibrating:
            raise RoomConflictError("The quest can only go live after calibration.")

        session = self._get_room_session_locked(room)
        if session.state == "complete":
            raise RoomConflictError("This room needs a new quest before starting again.")

        session.state = "active"
        room.status = RoomStatus.active
        room.elapsed_seconds = 0
        room.timer_started_at = self._now()
        self._touch_locked(room)

    def _pause_session_locked(self, room: RoomRecord) -> None:
        if room.status is not RoomStatus.active:
            raise RoomConflictError("Pause is only available during an active quest.")
        self._capture_elapsed_locked(room)
        room.status = RoomStatus.paused
        self._touch_locked(room)

    def _resume_session_locked(self, room: RoomRecord) -> None:
        if room.status is not RoomStatus.paused:
            raise RoomConflictError("Resume is only available while paused.")
        room.status = RoomStatus.active
        room.timer_started_at = self._now()
        self._touch_locked(room)

    def _advance_session_locked(self, room: RoomRecord, *, skipped: bool) -> None:
        if room.status not in {RoomStatus.active, RoomStatus.paused, RoomStatus.rest}:
            raise RoomConflictError("Advance is not available from the current room state.")
        session = self._get_room_session_locked(room)
        current_segment = session.segments[session.current_index]
        if skipped:
            room.skipped_segments.append(current_segment.name)

        advanced_session = session_engine.advance(session.id)
        if advanced_session is None:
            raise RoomConflictError("This room does not have an active session.")

        if advanced_session.state == "complete":
            self._capture_elapsed_locked(room)
            room.status = RoomStatus.complete
        else:
            advanced_session.state = "active"
            if room.status == RoomStatus.paused:
                room.timer_started_at = self._now()
            room.status = RoomStatus.active
        self._touch_locked(room)

    def _end_session_locked(self, room: RoomRecord) -> None:
        if room.controller_mode is None:
            raise RoomConflictError("There is no controller connected to end this room.")
        if room.status == RoomStatus.active:
            self._capture_elapsed_locked(room)
        room.status = RoomStatus.ended
        room.timer_started_at = None
        self._touch_locked(room)

    def _reset_for_another_quest_locked(self, room: RoomRecord) -> None:
        if room.status not in {RoomStatus.complete, RoomStatus.ended}:
            raise RoomConflictError("Start another quest is only available after a quest ends.")
        now = self._now()
        room.status = RoomStatus.connected
        room.selected_routine_id = None
        room.session_id = None
        room.skipped_segments = []
        room.elapsed_seconds = 0
        room.timer_started_at = None
        room.expires_at = now + self._ttl
        room.updated_at = now

    def _ensure_controller_locked(self, room: RoomRecord) -> None:
        if room.controller_mode is None:
            raise RoomConflictError("Join this room before sending commands.")

    def _ensure_routine_locked(self, room: RoomRecord) -> None:
        if room.selected_routine_id is None:
            raise RoomConflictError("Select a routine first.")

    def _get_active_room_locked(self, room_code: str) -> RoomRecord:
        code = self._normalize_room_code(room_code)
        now = self._now()
        self._prune_locked(now)

        room = self._rooms.get(code)
        if room is None:
            raise RoomNotFoundError("This room does not exist or has expired.")

        if self._is_expired_locked(room, now):
            room.status = RoomStatus.expired
            room.updated_at = now
            raise RoomExpiredError("This room has expired. Refresh the display for a new code.")

        if room.status is RoomStatus.expired:
            raise RoomExpiredError("This room has expired. Refresh the display for a new code.")

        return room

    def _get_room_session_locked(self, room: RoomRecord):
        if room.session_id is None:
            raise RoomConflictError("This room does not have an active session.")
        session = session_engine.get_session(room.session_id)
        if session is None:
            raise RoomConflictError("This room does not have an active session.")
        return session

    def _serialize_room_locked(self, room: RoomRecord, now: datetime) -> RoomResponse:
        routine = SUPPORTED_ROUTINES.get(room.selected_routine_id) if room.selected_routine_id else None
        session_payload = None
        if room.session_id:
            session = session_engine.get_session(room.session_id)
            if session is not None:
                current_segment = session.segments[session.current_index]
                feedback_message = self._feedback_message(current_segment.feedback_tags)
                elapsed_seconds = room.elapsed_seconds
                if room.status is RoomStatus.active and room.timer_started_at is not None:
                    elapsed_seconds += max(
                        0,
                        int((now - room.timer_started_at).total_seconds()),
                    )
                session_payload = RoomSessionResponse(
                    id=session.id,
                    state=session.state,
                    current_index=session.current_index,
                    current_name=current_segment.name,
                    total_stretches=len(session.routine),
                    total_score=session.total_score,
                    xp_earned=session.xp_earned,
                    current_stars=current_segment.stars,
                    total_stars=sum(segment.stars for segment in session.segments),
                    elapsed_seconds=elapsed_seconds,
                    feedback_message=feedback_message,
                    started_at=session.started_at,
                    completed_at=session.completed_at,
                    segments=[
                        RoomSessionSegmentResponse(
                            name=segment.name,
                            score=segment.score,
                            stars=segment.stars,
                            feedback_tags=list(segment.feedback_tags),
                        )
                        for segment in session.segments
                    ],
                )

        return RoomResponse(
            code=room.code,
            status=room.status,
            join_path=f"/join/{room.code}",
            display_path=f"/display/{room.code}",
            expires_at=room.expires_at,
            selected_routine=routine,
            session=session_payload,
            controller_mode=room.controller_mode,
            skipped_segments=list(room.skipped_segments),
        )

    def _normalize_room_code(self, room_code: str) -> str:
        code = room_code.strip().upper()
        if not ROOM_CODE_PATTERN.fullmatch(code):
            raise RoomNotFoundError("This room does not exist or has expired.")
        return code

    def _parse_command(self, command_type: str) -> RoomCommandType:
        try:
            return RoomCommandType(command_type)
        except ValueError as exc:
            logger.warning("Unsupported room command: %s", command_type)
            raise RoomValidationError("Unsupported command.") from exc

    def _validate_socket_role(self, role: str) -> str:
        if role not in {"display", "controller"}:
            raise RoomNotFoundError("This room does not exist or has expired.")
        return role

    def _reject_duplicate_command_locked(self, room: RoomRecord, command_type: str) -> None:
        if room.last_command_type != command_type or room.last_command_at is None:
            return
        if (self._now() - room.last_command_at).total_seconds() >= COMMAND_DEBOUNCE_SECONDS:
            return
        raise RoomConflictError("That command is already being processed.")

    def _capture_elapsed_locked(self, room: RoomRecord) -> None:
        if room.timer_started_at is None:
            return
        room.elapsed_seconds += max(
            0,
            int((self._now() - room.timer_started_at).total_seconds()),
        )
        room.timer_started_at = None

    def _touch_locked(self, room: RoomRecord) -> None:
        room.updated_at = self._now()

    def _reset_to_waiting_locked(self, room: RoomRecord) -> None:
        now = self._now()
        room.status = RoomStatus.waiting
        room.controller_mode = None
        room.selected_routine_id = None
        room.session_id = None
        room.skipped_segments = []
        room.elapsed_seconds = 0
        room.timer_started_at = None
        room.last_command_type = None
        room.last_command_at = None
        room.expires_at = now + self._ttl
        room.updated_at = now

    def _prune_locked(self, now: datetime) -> None:
        removable: list[str] = []
        for code, room in self._rooms.items():
            if self._is_expired_locked(room, now):
                room.status = RoomStatus.expired
                room.updated_at = now
            if room.status is RoomStatus.expired and now - room.updated_at > self._stale_retention:
                removable.append(code)
            if room.status is RoomStatus.ended and now - room.updated_at > self._stale_retention:
                removable.append(code)
        for code in removable:
            self._rooms.pop(code, None)
            self._sockets.pop(code, None)

    def _is_expired_locked(self, room: RoomRecord, now: datetime) -> bool:
        if room.session_id is not None:
            return False
        if room.status in {
            RoomStatus.active,
            RoomStatus.paused,
            RoomStatus.rest,
            RoomStatus.complete,
            RoomStatus.ended,
        }:
            return False
        return now >= room.expires_at

    def _feedback_message(self, feedback_tags: list[str]) -> str:
        if "step into frame" in feedback_tags:
            return "Stand where the camera can see you."
        if "center your body" in feedback_tags:
            return "Center your shoulders in the frame."
        if "show upper body" in feedback_tags:
            return "Show your upper body in the frame."
        if "show full body" in feedback_tags:
            return "Show your full body in the frame."
        if "tilt your head gently" in feedback_tags:
            return "Tilt your head gently."
        if "relax your shoulders" in feedback_tags:
            return "Relax your shoulders."
        if "open both arms wider" in feedback_tags:
            return "Open both arms wider."
        if "lift arms to shoulder height" in feedback_tags:
            return "Lift your arms to shoulder height."
        if "even out both arms" in feedback_tags:
            return "Even out both arms."
        if "reach one arm up" in feedback_tags:
            return "Reach one arm up."
        if "lean farther to the side" in feedback_tags:
            return "Lean farther to the side."
        if "lean away from raised arm" in feedback_tags:
            return "Lean away from your raised arm."
        if "keep hips level" in feedback_tags:
            return "Keep your hips level."
        if "reach lower" in feedback_tags:
            return "Reach lower."
        if "hinge forward a little more" in feedback_tags:
            return "Hinge forward a little more."
        if "reach toward your shins" in feedback_tags:
            return "Reach toward your shins."
        if "keep hips even" in feedback_tags:
            return "Keep your hips even."
        if "hold the shape" in feedback_tags:
            return "Hold the shape."
        if "improve lighting" in feedback_tags:
            return "Make sure the area is well lit."
        return "Hold steady. You are doing great."

    def _generate_room_code(self) -> str:
        return "".join(random.choice(ROOM_CODE_ALPHABET) for _ in range(4))

    def _now(self) -> datetime:
        return datetime.now(UTC)


room_service = RoomService(ttl_seconds=settings.room_ttl_seconds)
