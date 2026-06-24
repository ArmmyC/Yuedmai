from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.scoring import PoseSignal, score_pose
from app.services.session_engine import session_engine

client = TestClient(app)


def setup_function() -> None:
    session_engine.reset()


def test_score_pose_standing_side_bend_rewards_good_alignment() -> None:
    score, stars, tags = score_pose(
        PoseSignal(
            visible=True,
            centered=True,
            confidence=0.86,
            steady=True,
            hold_seconds=6,
            stretch_name="Standing side bend",
            alignment_score=0.92,
            torso_lean=0.82,
            arm_lift_score=0.9,
            hip_level_score=0.84,
            full_body_visible=True,
            direction_matched=True,
            hold_ready=True,
            feedback_tags=[],
        )
    )

    assert score >= 85
    assert stars == 3
    assert tags == []


def test_score_pose_standing_side_bend_emits_specific_coaching_tags() -> None:
    score, stars, tags = score_pose(
        PoseSignal(
            visible=True,
            centered=True,
            confidence=0.72,
            steady=False,
            hold_seconds=0,
            stretch_name="Standing side bend",
            alignment_score=0.18,
            torso_lean=0.2,
            arm_lift_score=0.18,
            hip_level_score=0.3,
            full_body_visible=False,
            direction_matched=False,
            hold_ready=False,
            feedback_tags=[
                "show full body",
                "reach one arm up",
                "lean farther to the side",
                "keep hips level",
            ],
        )
    )

    assert score < 70
    assert stars <= 1
    assert "show full body" in tags
    assert "reach one arm up" in tags
    assert "lean farther to the side" in tags
    assert "keep hips level" in tags
    assert "hold the shape" in tags


def test_session_score_endpoint_accepts_stretch_specific_metrics() -> None:
    session = client.post("/api/sessions", json={"routine": ["Standing side bend"]})
    assert session.status_code == 200
    session_id = session.json()["id"]

    scored = client.post(
        f"/api/sessions/{session_id}/score",
        json={
            "visible": True,
            "centered": True,
            "confidence": 0.82,
            "steady": True,
            "hold_seconds": 4,
            "stretch_name": "Standing side bend",
            "alignment_score": 0.88,
            "torso_lean": 0.74,
            "arm_lift_score": 0.86,
            "hip_level_score": 0.8,
            "full_body_visible": True,
            "direction_matched": True,
            "hold_ready": True,
            "feedback_tags": [],
        },
    )

    assert scored.status_code == 200
    body = scored.json()
    assert body["segments"][0]["name"] == "Standing side bend"
    assert body["segments"][0]["stars"] >= 2
    assert body["segments"][0]["feedback_tags"] == []


def test_session_score_endpoint_preserves_frontend_feedback_tags_for_other_stretches() -> None:
    session = client.post("/api/sessions", json={"routine": ["Shoulder opener"]})
    assert session.status_code == 200
    session_id = session.json()["id"]

    scored = client.post(
        f"/api/sessions/{session_id}/score",
        json={
            "visible": True,
            "centered": True,
            "confidence": 0.79,
            "steady": True,
            "hold_seconds": 2,
            "stretch_name": "Shoulder opener",
            "alignment_score": 0.61,
            "full_body_visible": False,
            "hold_ready": False,
            "feedback_tags": ["open both arms wider", "lift arms to shoulder height"],
        },
    )

    assert scored.status_code == 200
    body = scored.json()
    assert body["segments"][0]["feedback_tags"] == ["open both arms wider", "lift arms to shoulder height"]
