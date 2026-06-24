from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.room_service import room_service
from app.services.session_engine import session_engine

client = TestClient(app)


def setup_function() -> None:
    room_service.reset()
    session_engine.reset()


def test_create_and_get_room_payload() -> None:
    created = client.post("/api/rooms")
    assert created.status_code == 200
    room = created.json()

    assert room["status"] == "waiting"
    assert room["join_path"] == f"/join/{room['code']}"
    assert room["display_path"] == f"/display/{room['code']}"

    loaded = client.get(f"/api/rooms/{room['code']}")
    assert loaded.status_code == 200
    assert loaded.json()["code"] == room["code"]


def test_join_duplicate_join_and_routine_selection_flow() -> None:
    room = client.post("/api/rooms").json()

    joined = client.post(f"/api/rooms/{room['code']}/join", json={"mode": "guest"})
    duplicate = client.post(f"/api/rooms/{room['code']}/join", json={"mode": "guest"})
    routines = client.get("/api/rooms/routines")
    selected = client.post(
        f"/api/rooms/{room['code']}/routine",
        json={"routine_id": "quick-reset"},
    )

    assert joined.status_code == 200
    assert joined.json()["status"] == "connected"
    assert duplicate.status_code == 409
    assert routines.status_code == 200
    assert routines.json()["routines"][0]["name"] == "Quick Reset"
    assert selected.status_code == 200
    assert selected.json()["status"] == "routine_selected"


def test_room_commands_handle_valid_and_invalid_state_changes() -> None:
    room = client.post("/api/rooms").json()
    code = room["code"]

    invalid = client.post(f"/api/rooms/{code}/commands", json={"type": "NOPE"})
    wrong_state = client.post(f"/api/rooms/{code}/commands", json={"type": "PAUSE_SESSION"})

    client.post(f"/api/rooms/{code}/join", json={"mode": "guest"})
    client.post(f"/api/rooms/{code}/routine", json={"routine_id": "quick-reset"})

    calibration = client.post(f"/api/rooms/{code}/commands", json={"type": "START_CALIBRATION"})
    quest = client.post(f"/api/rooms/{code}/commands", json={"type": "START_SESSION"})
    pause = client.post(f"/api/rooms/{code}/commands", json={"type": "PAUSE_SESSION"})
    resume = client.post(f"/api/rooms/{code}/commands", json={"type": "RESUME_SESSION"})
    skip = client.post(f"/api/rooms/{code}/commands", json={"type": "SKIP_STRETCH"})
    end = client.post(f"/api/rooms/{code}/commands", json={"type": "END_SESSION"})
    another = client.post(f"/api/rooms/{code}/commands", json={"type": "START_ANOTHER_QUEST"})

    assert invalid.status_code == 400
    assert wrong_state.status_code == 409
    assert calibration.status_code == 200
    assert calibration.json()["status"] == "calibrating"
    assert quest.status_code == 200
    assert quest.json()["status"] == "active"
    assert pause.status_code == 200
    assert pause.json()["status"] == "paused"
    assert resume.status_code == 200
    assert resume.json()["status"] == "active"
    assert skip.status_code == 200
    assert "Neck reset" in skip.json()["skipped_segments"]
    assert end.status_code == 200
    assert end.json()["status"] == "ended"
    assert another.status_code == 200
    assert another.json()["status"] == "connected"


def test_display_websocket_receives_room_updates() -> None:
    room = client.post("/api/rooms").json()
    code = room["code"]

    with client.websocket_connect(f"/ws/rooms/{code}/display") as websocket:
        initial = websocket.receive_json()
        assert initial["type"] == "ROOM_STATE"
        assert initial["room"]["status"] == "waiting"

        joined = client.post(f"/api/rooms/{code}/join", json={"mode": "guest"})
        assert joined.status_code == 200

        update = websocket.receive_json()
        assert update["type"] == "ROOM_UPDATED"
        assert update["room"]["status"] == "connected"


def test_existing_session_and_pose_endpoints_still_work() -> None:
    session = client.post("/api/sessions", json={})
    assert session.status_code == 200
    session_id = session.json()["id"]

    loaded = client.get(f"/api/sessions/{session_id}")
    assert loaded.status_code == 200
    assert loaded.json()["id"] == session_id

    scored = client.post(
        f"/api/sessions/{session_id}/score",
        json={
            "visible": True,
            "centered": True,
            "confidence": 0.8,
            "steady": True,
            "hold_seconds": 6,
        },
    )
    advanced = client.post(f"/api/sessions/{session_id}/advance")

    assert scored.status_code == 200
    assert advanced.status_code == 200
    assert "session" in advanced.json()

    with client.websocket_connect("/ws/pose-stream") as websocket:
        websocket.send_json(
            {
                "width": 960,
                "height": 540,
                "holdSeconds": 3,
                "timestamp": 123,
            }
        )
        payload = websocket.receive_json()
        assert "signal" in payload
        assert "message" in payload
