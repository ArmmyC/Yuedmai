from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PoseSignal:
    visible: bool
    centered: bool
    confidence: float
    steady: bool
    hold_seconds: float
    stretch_name: str | None = None
    alignment_score: float = 0.0
    torso_lean: float = 0.0
    arm_lift_score: float = 0.0
    hip_level_score: float = 0.0
    full_body_visible: bool = False
    direction_matched: bool = False
    hold_ready: bool = False
    feedback_tags: list[str] = field(default_factory=list)


def score_pose(signal: PoseSignal) -> tuple[int, int, list[str]]:
    if signal.stretch_name:
        return score_stretch_pose(signal)
    return score_generic_pose(signal)


def score_generic_pose(signal: PoseSignal) -> tuple[int, int, list[str]]:
    """Score consistency and safe visibility rather than body shape or flexibility."""
    score = 40
    tags: list[str] = []

    if signal.visible:
        score += 20
    else:
        tags.append("step into frame")

    if signal.centered:
        score += 12
    else:
        tags.append("center your body")

    if signal.confidence >= 0.65:
        score += 12
    elif signal.confidence < 0.35:
        tags.append("improve lighting")

    if signal.steady:
        score += 10
    else:
        tags.append("hold steady")

    score += min(6, int(max(0.0, signal.hold_seconds) // 5))
    score = max(0, min(100, score))

    stars = 3 if score >= 85 else 2 if score >= 65 else 1 if score >= 40 else 0
    return score, stars, tags


def score_stretch_pose(signal: PoseSignal) -> tuple[int, int, list[str]]:
    score = 12
    tags = dedupe(signal.feedback_tags)

    if signal.visible:
        score += 12
    else:
        push_tag(tags, "step into frame")

    if signal.centered:
        score += 8
    else:
        push_tag(tags, "center your body")

    if signal.confidence >= 0.65:
        score += 10
    elif signal.confidence < 0.35:
        push_tag(tags, "improve lighting")

    if signal.full_body_visible:
        score += 6

    if signal.steady:
        score += 8
    elif "hold the shape" not in tags and "hold steady" not in tags:
        push_tag(tags, "hold the shape")

    score += int(clamp01(signal.alignment_score) * 36)
    if signal.hold_ready:
        score += 10
    score += min(10, int(max(0.0, signal.hold_seconds) // 2))
    score = max(0, min(100, score))

    stars = 3 if score >= 80 else 2 if score >= 60 else 1 if score >= 40 else 0
    return score, stars, tags


def dedupe(tags: list[str]) -> list[str]:
    return list(dict.fromkeys(tags))


def push_tag(tags: list[str], tag: str) -> None:
    if tag not in tags:
        tags.append(tag)


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def xp_from_session(total_score: int, completed_segments: int, completed: bool) -> int:
    base = completed_segments * 20
    score_bonus = max(0, min(80, total_score // max(1, completed_segments * 2)))
    completion_bonus = 50 if completed else 0
    return base + score_bonus + completion_bonus
