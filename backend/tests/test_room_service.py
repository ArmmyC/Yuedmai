from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.services.room_service import (
    RoomConflictError,
    RoomExpiredError,
    RoomNotFoundError,
    RoomSocketGroup,
    RoomService,
)
from app.services.session_engine import session_engine


@pytest.fixture(autouse=True)
def reset_session_engine() -> None:
    session_engine.reset()


def create_ready_room(service: RoomService) -> str:
    room = service.create_room()
    service.join_room(room.code, "guest")
    service.select_routine(room.code, "quick-reset")
    return room.code


def rewind_duplicate_guard(service: RoomService, room_code: str) -> None:
    service._rooms[room_code].last_command_at = datetime.now(UTC) - timedelta(seconds=1)


def test_create_room_returns_unique_uppercase_codes() -> None:
    service = RoomService()

    first = service.create_room()
    second = service.create_room()

    assert first.code != second.code
    assert len(first.code) == 4
    assert first.code.isupper()
    assert first.status == "waiting"


def test_expired_rooms_reject_join_and_commands() -> None:
    service = RoomService()
    room = service.create_room()
    service._rooms[room.code].expires_at = datetime.now(UTC) - timedelta(seconds=1)

    with pytest.raises(RoomExpiredError):
        service.join_room(room.code, "guest")

    with pytest.raises(RoomExpiredError):
        service.send_command(room.code, "START_SESSION")


def test_guest_join_and_routine_selection_move_room_forward() -> None:
    service = RoomService()
    room = service.create_room()

    joined = service.join_room(room.code, "guest")
    selected = service.select_routine(room.code, "quick-reset")
    calibrating = service.send_command(room.code, "START_CALIBRATION")

    assert joined.status == "connected"
    assert joined.controller_mode == "guest"
    assert selected.status == "routine_selected"
    assert selected.selected_routine.name == "Quick Reset"
    assert calibrating.status == "calibrating"


def test_fun_routine_is_available_and_selectable() -> None:
    service = RoomService()
    room = service.create_room()
    service.join_room(room.code, "guest")

    routine_ids = [routine.id for routine in service.list_routines()]
    selected = service.select_routine(room.code, "meme-mode")

    assert "quick-reset" in routine_ids
    assert "meme-mode" in routine_ids
    assert selected.selected_routine is not None
    assert selected.selected_routine.name == "Meme Mode"
    assert "Robot freeze" in selected.selected_routine.stretches


def test_start_pause_and_resume_session_follow_valid_states() -> None:
    service = RoomService()
    room_code = create_ready_room(service)

    calibration = service.send_command(room_code, "START_SESSION")
    rewind_duplicate_guard(service, room_code)
    active = service.send_command(room_code, "BEGIN_ACTIVE_SESSION")
    rewind_duplicate_guard(service, room_code)
    paused = service.send_command(room_code, "PAUSE_SESSION")
    rewind_duplicate_guard(service, room_code)
    resumed = service.send_command(room_code, "RESUME_SESSION")

    assert calibration.status == "calibrating"
    assert calibration.session is not None
    assert active.status == "active"
    assert active.session is not None
    assert paused.status == "paused"
    assert resumed.status == "active"


def test_next_and_skip_advance_session_and_complete_room() -> None:
    service = RoomService()
    room_code = create_ready_room(service)
    service.send_command(room_code, "START_SESSION")
    rewind_duplicate_guard(service, room_code)
    service.send_command(room_code, "BEGIN_ACTIVE_SESSION")

    rewind_duplicate_guard(service, room_code)
    after_skip = service.send_command(room_code, "SKIP_STRETCH")
    rewind_duplicate_guard(service, room_code)
    service.send_command(room_code, "NEXT_STRETCH")
    rewind_duplicate_guard(service, room_code)
    service.send_command(room_code, "SKIP_STRETCH")
    rewind_duplicate_guard(service, room_code)
    complete = service.send_command(room_code, "NEXT_STRETCH")

    assert after_skip.skipped_segments == ["Neck reset"]
    assert complete.status == "complete"
    assert complete.skipped_segments == ["Neck reset", "Standing side bend"]
    assert complete.session is not None
    assert complete.session.xp_earned > 0


def test_duplicate_commands_do_not_corrupt_room_state() -> None:
    service = RoomService()
    room_code = create_ready_room(service)
    service.send_command(room_code, "START_SESSION")
    rewind_duplicate_guard(service, room_code)
    service.send_command(room_code, "BEGIN_ACTIVE_SESSION")
    rewind_duplicate_guard(service, room_code)

    first = service.send_command(room_code, "NEXT_STRETCH")
    with pytest.raises(RoomConflictError):
        service.send_command(room_code, "NEXT_STRETCH")

    room = service.get_room(room_code)
    assert first.session is not None
    assert first.session.current_index == 1
    assert room.session is not None
    assert room.session.current_index == 1


def test_invalid_room_code_format_is_rejected() -> None:
    service = RoomService()

    with pytest.raises(RoomNotFoundError):
        service.get_room("bad!")


def test_controller_disconnect_resets_room_to_waiting() -> None:
    service = RoomService()
    room_code = create_ready_room(service)
    display_socket = object()
    controller_socket = object()
    service._sockets[room_code] = RoomSocketGroup(
        display={display_socket},
        controller={controller_socket},
    )

    room_reset = asyncio.run(service.disconnect(room_code, "controller", controller_socket))
    room = service.get_room(room_code)

    assert room_reset is True
    assert room.status == "waiting"
    assert room.controller_mode is None
    assert room.selected_routine is None
    assert room.session is None
