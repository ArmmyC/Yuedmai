import type { KioskPoseSignal, PoseSample } from "@/pose-landmarker";

type PoseLandmarkLike = {
  x: number;
  y: number;
  visibility?: number;
};

type GuideSide = "left" | "right" | "both";
type LandmarkName = keyof typeof LANDMARK_INDEX;
type PoseFrame = {
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
};
type TemplatePoint = {
  name: LandmarkName;
  x: number;
  y: number;
  toleranceX?: number;
  toleranceY?: number;
  weight?: number;
};
type TemplateVariant<Id extends string = string> = {
  id: Id;
  points: TemplatePoint[];
};

export type StretchGuideOverlay =
  | {
      kind: "neck-reset";
      targetSide: GuideSide;
      aligned: boolean;
    }
  | {
      kind: "shoulder-opener";
      aligned: boolean;
    }
  | {
      kind: "standing-side-bend";
      targetSide: GuideSide;
      raisedArmSide: "left" | "right" | null;
      leanSide: "left" | "right" | null;
      aligned: boolean;
    }
  | {
      kind: "hamstring-reach";
      aligned: boolean;
    }
  | {
      kind: "none";
    };

export type StretchEvaluation = {
  message: string;
  holdReady: boolean;
  alignmentScore: number;
  feedbackTags: string[];
  overlay: StretchGuideOverlay;
  payload: {
    stretch_name: string;
    alignment_score: number;
    torso_lean: number;
    arm_lift_score: number;
    hip_level_score: number;
    full_body_visible: boolean;
    direction_matched: boolean;
    hold_ready: boolean;
    feedback_tags: string[];
  };
};

const LANDMARK_INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

const SHOULDER_OPENER_TEMPLATES: TemplateVariant[] = [
  {
    id: "open",
    points: [
      { name: "nose", x: 0, y: -1.72, toleranceX: 0.45, toleranceY: 0.55, weight: 0.7 },
      { name: "leftElbow", x: -1.02, y: -1.02, toleranceX: 0.5, toleranceY: 0.42, weight: 1 },
      { name: "rightElbow", x: 1.02, y: -1.02, toleranceX: 0.5, toleranceY: 0.42, weight: 1 },
      { name: "leftWrist", x: -1.82, y: -1.02, toleranceX: 0.58, toleranceY: 0.48, weight: 1.2 },
      { name: "rightWrist", x: 1.82, y: -1.02, toleranceX: 0.58, toleranceY: 0.48, weight: 1.2 },
    ],
  },
];

const SIDE_BEND_TEMPLATES: Array<
  TemplateVariant<"lean-left" | "lean-right"> & {
    targetSide: "left" | "right";
    raisedArmSide: "left" | "right";
    leanSide: "left" | "right";
  }
> = [
  {
    id: "lean-left",
    targetSide: "left",
    raisedArmSide: "right",
    leanSide: "left",
    points: [
      { name: "nose", x: -0.3, y: -1.55, toleranceX: 0.52, toleranceY: 0.5, weight: 0.9 },
      { name: "leftShoulder", x: -0.72, y: -1.02, toleranceX: 0.48, toleranceY: 0.44, weight: 0.7 },
      { name: "rightShoulder", x: 0.14, y: -1.22, toleranceX: 0.48, toleranceY: 0.44, weight: 0.7 },
      { name: "leftWrist", x: -1.02, y: -0.72, toleranceX: 0.58, toleranceY: 0.6, weight: 0.8 },
      { name: "rightWrist", x: 0.18, y: -2.32, toleranceX: 0.52, toleranceY: 0.6, weight: 1.2 },
    ],
  },
  {
    id: "lean-right",
    targetSide: "right",
    raisedArmSide: "left",
    leanSide: "right",
    points: [
      { name: "nose", x: 0.3, y: -1.55, toleranceX: 0.52, toleranceY: 0.5, weight: 0.9 },
      { name: "leftShoulder", x: -0.14, y: -1.22, toleranceX: 0.48, toleranceY: 0.44, weight: 0.7 },
      { name: "rightShoulder", x: 0.72, y: -1.02, toleranceX: 0.48, toleranceY: 0.44, weight: 0.7 },
      { name: "leftWrist", x: -0.18, y: -2.32, toleranceX: 0.52, toleranceY: 0.6, weight: 1.2 },
      { name: "rightWrist", x: 1.02, y: -0.72, toleranceX: 0.58, toleranceY: 0.6, weight: 0.8 },
    ],
  },
];

const HAMSTRING_REACH_TEMPLATES: TemplateVariant[] = [
  {
    id: "fold",
    points: [
      { name: "nose", x: 0, y: -0.32, toleranceX: 0.42, toleranceY: 0.62, weight: 0.8 },
      { name: "leftShoulder", x: -0.24, y: -0.62, toleranceX: 0.4, toleranceY: 0.52, weight: 0.7 },
      { name: "rightShoulder", x: 0.24, y: -0.62, toleranceX: 0.4, toleranceY: 0.52, weight: 0.7 },
      { name: "leftWrist", x: -0.26, y: 0.94, toleranceX: 0.42, toleranceY: 0.6, weight: 1.1 },
      { name: "rightWrist", x: 0.26, y: 0.94, toleranceX: 0.42, toleranceY: 0.6, weight: 1.1 },
      { name: "leftKnee", x: -0.34, y: 1.42, toleranceX: 0.34, toleranceY: 0.46, weight: 0.5 },
      { name: "rightKnee", x: 0.34, y: 1.42, toleranceX: 0.34, toleranceY: 0.46, weight: 0.5 },
    ],
  },
];

export function evaluateStretchPose(
  stretchName: string,
  landmarks: PoseLandmarkLike[] | undefined,
  signal: KioskPoseSignal,
  sample: PoseSample | null,
): StretchEvaluation | null {
  const points = landmarks ?? [];
  const normalizedName = stretchName.trim().toLowerCase();

  switch (normalizedName) {
    case "neck reset":
      return evaluateNeckReset(points, signal, sample);
    case "shoulder opener":
      return evaluateShoulderOpener(points, signal, sample);
    case "standing side bend":
      return evaluateStandingSideBend(points, signal, sample);
    case "hamstring reach":
      return evaluateHamstringReach(points, signal, sample);
    default:
      return null;
  }
}

function evaluateNeckReset(
  landmarks: PoseLandmarkLike[],
  signal: KioskPoseSignal,
  sample: PoseSample | null,
): StretchEvaluation {
  const nose = landmarks[LANDMARK_INDEX.nose];
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
  const upperVisible = sample?.upperBodyVisible ?? false;

  if (!nose || !leftShoulder || !rightShoulder || !sample) {
    return makeFallbackEvaluation("Neck reset", "Step into frame", ["step into frame"], {
      kind: "neck-reset",
      targetSide: "both",
      aligned: false,
    });
  }

  const shoulderCenterX = average([leftShoulder.x, rightShoulder.x]);
  const shoulderSpan = Math.max(0.08, Math.abs(leftShoulder.x - rightShoulder.x));
  const tiltOffset = Math.abs(nose.x - shoulderCenterX) / shoulderSpan;
  const tiltScore = clamp01((tiltOffset - 0.08) / 0.24);
  const shoulderLevelScore = clamp01(1 - Math.abs(leftShoulder.y - rightShoulder.y) / 0.06);
  const tiltSide = tiltOffset < 0.08 ? "both" : nose.x < shoulderCenterX ? "left" : "right";

  const alignmentScore = clamp01(tiltScore * 0.58 + shoulderLevelScore * 0.42);
  const holdReady =
    signal.visible &&
    signal.centered &&
    signal.confidence >= 0.55 &&
    signal.steady &&
    upperVisible &&
    tiltScore >= 0.5 &&
    shoulderLevelScore >= 0.62;

  const feedbackTags: string[] = [];
  let message = "Gentle hold";

  if (!signal.visible) {
    feedbackTags.push("step into frame");
    message = "Step into frame";
  } else if (!signal.centered) {
    feedbackTags.push("center your body");
    message = "Center your body";
  } else if (!upperVisible) {
    feedbackTags.push("show upper body");
    message = "Show upper body";
  } else if (tiltScore < 0.44) {
    feedbackTags.push("tilt your head gently");
    message = "Tilt your head gently";
  } else if (shoulderLevelScore < 0.62) {
    feedbackTags.push("relax your shoulders");
    message = "Relax your shoulders";
  } else if (!signal.steady) {
    feedbackTags.push("hold the shape");
    message = "Hold the shape";
  }

  if (signal.confidence < 0.35) {
    pushTag(feedbackTags, "improve lighting");
    message = "More light";
  }

  return buildEvaluation({
    stretchName: "Neck reset",
    message,
    holdReady,
    alignmentScore,
    feedbackTags,
    overlay: {
      kind: "neck-reset",
      targetSide: tiltSide,
      aligned: holdReady,
    },
    payload: {
      torso_lean: tiltScore,
      arm_lift_score: 0,
      hip_level_score: shoulderLevelScore,
      full_body_visible: sample.fullBodyVisible,
      direction_matched: true,
    },
  });
}

function evaluateShoulderOpener(
  landmarks: PoseLandmarkLike[],
  signal: KioskPoseSignal,
  sample: PoseSample | null,
): StretchEvaluation {
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
  const leftWrist = landmarks[LANDMARK_INDEX.leftWrist];
  const rightWrist = landmarks[LANDMARK_INDEX.rightWrist];
  const upperVisible = sample?.upperBodyVisible ?? false;

  if (!sample || !leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
    return makeFallbackEvaluation("Shoulder opener", "Step into frame", ["step into frame"], {
      kind: "shoulder-opener",
      aligned: false,
    });
  }

  const leftReach = clamp01((leftShoulder.x - leftWrist.x - 0.02) / 0.22);
  const rightReach = clamp01((rightWrist.x - rightShoulder.x - 0.02) / 0.22);
  const reachScore = average([leftReach, rightReach]);
  const templateScore = getBestTemplateMatch(landmarks, SHOULDER_OPENER_TEMPLATES).score;
  const armHeightScore = clamp01(
    1 - average([Math.abs(leftWrist.y - leftShoulder.y), Math.abs(rightWrist.y - rightShoulder.y)]) / 0.14,
  );
  const symmetryScore = clamp01(
    1 - Math.abs((leftShoulder.y - leftWrist.y) - (rightShoulder.y - rightWrist.y)) / 0.12,
  );
  const alignmentScore = clamp01(
    reachScore * 0.3 + armHeightScore * 0.24 + symmetryScore * 0.16 + templateScore * 0.3,
  );

  const holdReady =
    signal.visible &&
    signal.centered &&
    signal.confidence >= 0.55 &&
    signal.steady &&
    upperVisible &&
    reachScore >= 0.58 &&
    armHeightScore >= 0.56 &&
    symmetryScore >= 0.5 &&
    templateScore >= 0.46;

  const feedbackTags: string[] = [];
  let message = "Open and hold";

  if (!signal.visible) {
    feedbackTags.push("step into frame");
    message = "Step into frame";
  } else if (!signal.centered) {
    feedbackTags.push("center your body");
    message = "Center your body";
  } else if (!upperVisible) {
    feedbackTags.push("show upper body");
    message = "Show upper body";
  } else if (reachScore < 0.5) {
    feedbackTags.push("open both arms wider");
    message = "Open both arms wider";
  } else if (armHeightScore < 0.52) {
    feedbackTags.push("lift arms to shoulder height");
    message = "Lift arms to shoulder height";
  } else if (symmetryScore < 0.46) {
    feedbackTags.push("even out both arms");
    message = "Even out both arms";
  } else if (templateScore < 0.38) {
    feedbackTags.push("open both arms wider");
    message = "Match the guide";
  } else if (!signal.steady) {
    feedbackTags.push("hold the shape");
    message = "Hold the shape";
  }

  if (signal.confidence < 0.35) {
    pushTag(feedbackTags, "improve lighting");
    message = "More light";
  }

  return buildEvaluation({
    stretchName: "Shoulder opener",
    message,
    holdReady,
    alignmentScore,
    feedbackTags,
    overlay: {
      kind: "shoulder-opener",
      aligned: holdReady,
    },
    payload: {
      torso_lean: reachScore,
      arm_lift_score: armHeightScore,
      hip_level_score: symmetryScore,
      full_body_visible: sample.fullBodyVisible,
      direction_matched: true,
    },
  });
}

function evaluateStandingSideBend(
  landmarks: PoseLandmarkLike[],
  signal: KioskPoseSignal,
  sample: PoseSample | null,
): StretchEvaluation {
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
  const leftWrist = landmarks[LANDMARK_INDEX.leftWrist];
  const rightWrist = landmarks[LANDMARK_INDEX.rightWrist];
  const leftHip = landmarks[LANDMARK_INDEX.leftHip];
  const rightHip = landmarks[LANDMARK_INDEX.rightHip];

  if (!sample || !leftShoulder || !rightShoulder || !leftWrist || !rightWrist || !leftHip || !rightHip) {
    return makeFallbackEvaluation("Standing side bend", "Step into frame", ["step into frame"], {
      kind: "standing-side-bend",
      targetSide: "both",
      raisedArmSide: null,
      leanSide: null,
      aligned: false,
    });
  }

  const shoulderCenterX = average([leftShoulder.x, rightShoulder.x]);
  const hipCenterX = average([leftHip.x, rightHip.x]);
  const torsoShift = shoulderCenterX - hipCenterX;
  const shoulderSpan = Math.max(0.08, Math.abs(leftShoulder.x - rightShoulder.x));
  const torsoLean = clamp01((Math.abs(torsoShift) / shoulderSpan - 0.08) / 0.28);

  const leftArmLift = clamp01((leftShoulder.y - leftWrist.y + 0.02) / 0.24);
  const rightArmLift = clamp01((rightShoulder.y - rightWrist.y + 0.02) / 0.24);
  const armLiftScore = Math.max(leftArmLift, rightArmLift);
  const raisedArmSide = armLiftScore < 0.36 ? null : leftArmLift >= rightArmLift ? "left" : "right";
  const leanSide = Math.abs(torsoShift) < shoulderSpan * 0.12 ? null : torsoShift > 0 ? "right" : "left";
  const templateMatch = getBestTemplateMatch(landmarks, SIDE_BEND_TEMPLATES);
  const targetSide =
    raisedArmSide === "left"
      ? "right"
      : raisedArmSide === "right"
        ? "left"
        : leanSide ?? templateMatch.variant.targetSide;
  const directionMatched = Boolean(raisedArmSide) && Boolean(leanSide) ? raisedArmSide !== leanSide : false;
  const hipLevelScore = clamp01(1 - Math.abs(leftHip.y - rightHip.y) / 0.08);

  const alignmentScore = clamp01(
    armLiftScore * 0.26 +
      torsoLean * 0.24 +
      hipLevelScore * 0.14 +
      templateMatch.score * 0.22 +
      (directionMatched ? 0.1 : 0) +
      (sample.fullBodyVisible ? 0.04 : 0),
  );

  const holdReady =
    signal.visible &&
    signal.centered &&
    signal.confidence >= 0.55 &&
    signal.steady &&
    sample.fullBodyVisible &&
    armLiftScore >= 0.68 &&
    torsoLean >= 0.62 &&
    hipLevelScore >= 0.56 &&
    directionMatched &&
    templateMatch.score >= 0.45;

  const feedbackTags: string[] = [];
  let message = "Nice hold";

  if (!signal.visible) {
    feedbackTags.push("step into frame");
    message = "Step into frame";
  } else if (!signal.centered) {
    feedbackTags.push("center your body");
    message = "Center your body";
  } else if (!sample.fullBodyVisible) {
    feedbackTags.push("show full body");
    message = "Show full body";
  } else if (armLiftScore < 0.55) {
    feedbackTags.push("reach one arm up");
    message =
      raisedArmSide === "left"
        ? "Reach left arm higher"
        : raisedArmSide === "right"
          ? "Reach right arm higher"
          : "Reach one arm up";
  } else if (!leanSide || torsoLean < 0.48) {
    feedbackTags.push("lean farther to the side");
    message =
      raisedArmSide === "left"
        ? "Lean right"
        : raisedArmSide === "right"
          ? "Lean left"
          : "Lean to one side";
  } else if (!directionMatched) {
    feedbackTags.push("lean away from raised arm");
    message =
      raisedArmSide === "left"
        ? "Lean right"
        : raisedArmSide === "right"
          ? "Lean left"
          : "Lean away from your raised arm";
  } else if (hipLevelScore < 0.56) {
    feedbackTags.push("keep hips level");
    message = "Keep hips level";
  } else if (templateMatch.score < 0.38) {
    feedbackTags.push("lean farther to the side");
    message =
      templateMatch.variant.leanSide === "left"
        ? "Lean left"
        : templateMatch.variant.leanSide === "right"
          ? "Lean right"
          : "Match the guide";
  } else if (!signal.steady) {
    feedbackTags.push("hold the shape");
    message = "Hold the shape";
  }

  if (signal.confidence < 0.35) {
    pushTag(feedbackTags, "improve lighting");
    message = "More light";
  }

  return buildEvaluation({
    stretchName: "Standing side bend",
    message,
    holdReady,
    alignmentScore,
    feedbackTags,
    overlay: {
      kind: "standing-side-bend",
      targetSide,
      raisedArmSide,
      leanSide,
      aligned: holdReady,
    },
    payload: {
      torso_lean: torsoLean,
      arm_lift_score: armLiftScore,
      hip_level_score: hipLevelScore,
      full_body_visible: sample.fullBodyVisible,
      direction_matched: directionMatched,
    },
  });
}

function evaluateHamstringReach(
  landmarks: PoseLandmarkLike[],
  signal: KioskPoseSignal,
  sample: PoseSample | null,
): StretchEvaluation {
  const nose = landmarks[LANDMARK_INDEX.nose];
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
  const leftWrist = landmarks[LANDMARK_INDEX.leftWrist];
  const rightWrist = landmarks[LANDMARK_INDEX.rightWrist];
  const leftHip = landmarks[LANDMARK_INDEX.leftHip];
  const rightHip = landmarks[LANDMARK_INDEX.rightHip];
  const leftKnee = landmarks[LANDMARK_INDEX.leftKnee];
  const rightKnee = landmarks[LANDMARK_INDEX.rightKnee];

  if (
    !sample ||
    !nose ||
    !leftShoulder ||
    !rightShoulder ||
    !leftWrist ||
    !rightWrist ||
    !leftHip ||
    !rightHip ||
    !leftKnee ||
    !rightKnee
  ) {
    return makeFallbackEvaluation("Hamstring reach", "Step into frame", ["step into frame"], {
      kind: "hamstring-reach",
      aligned: false,
    });
  }

  const shoulderCenterY = average([leftShoulder.y, rightShoulder.y]);
  const hipCenterY = average([leftHip.y, rightHip.y]);
  const kneeCenterY = average([leftKnee.y, rightKnee.y]);
  const wristCenterY = average([leftWrist.y, rightWrist.y]);
  const foldScore = clamp01((nose.y - shoulderCenterY + 0.02) / 0.14);
  const reachDepthScore = clamp01((wristCenterY - hipCenterY + 0.02) / 0.24);
  const shinReachScore = clamp01((wristCenterY - kneeCenterY + 0.05) / 0.18);
  const templateScore = getBestTemplateMatch(landmarks, HAMSTRING_REACH_TEMPLATES).score;
  const hipLevelScore = clamp01(1 - Math.abs(leftHip.y - rightHip.y) / 0.08);
  const alignmentScore = clamp01(
    foldScore * 0.2 +
      reachDepthScore * 0.18 +
      shinReachScore * 0.22 +
      hipLevelScore * 0.1 +
      templateScore * 0.3,
  );

  const holdReady =
    signal.visible &&
    signal.centered &&
    signal.confidence >= 0.55 &&
    signal.steady &&
    sample.fullBodyVisible &&
    foldScore >= 0.4 &&
    reachDepthScore >= 0.48 &&
    shinReachScore >= 0.46 &&
    hipLevelScore >= 0.5 &&
    templateScore >= 0.42;

  const feedbackTags: string[] = [];
  let message = "Nice reach";

  if (!signal.visible) {
    feedbackTags.push("step into frame");
    message = "Step into frame";
  } else if (!signal.centered) {
    feedbackTags.push("center your body");
    message = "Center your body";
  } else if (!sample.fullBodyVisible) {
    feedbackTags.push("show full body");
    message = "Show full body";
  } else if (reachDepthScore < 0.42) {
    feedbackTags.push("reach lower");
    message = "Reach lower";
  } else if (foldScore < 0.34) {
    feedbackTags.push("hinge forward a little more");
    message = "Hinge forward a little more";
  } else if (shinReachScore < 0.42) {
    feedbackTags.push("reach toward your shins");
    message = "Reach toward your shins";
  } else if (hipLevelScore < 0.5) {
    feedbackTags.push("keep hips even");
    message = "Keep hips even";
  } else if (templateScore < 0.34) {
    feedbackTags.push("reach toward your shins");
    message = "Match the guide";
  } else if (!signal.steady) {
    feedbackTags.push("hold the shape");
    message = "Hold the shape";
  }

  if (signal.confidence < 0.35) {
    pushTag(feedbackTags, "improve lighting");
    message = "More light";
  }

  return buildEvaluation({
    stretchName: "Hamstring reach",
    message,
    holdReady,
    alignmentScore,
    feedbackTags,
    overlay: {
      kind: "hamstring-reach",
      aligned: holdReady,
    },
    payload: {
      torso_lean: foldScore,
      arm_lift_score: reachDepthScore,
      hip_level_score: hipLevelScore,
      full_body_visible: sample.fullBodyVisible,
      direction_matched: shinReachScore >= 0.42,
    },
  });
}

function buildEvaluation({
  stretchName,
  message,
  holdReady,
  alignmentScore,
  feedbackTags,
  overlay,
  payload,
}: {
  stretchName: string;
  message: string;
  holdReady: boolean;
  alignmentScore: number;
  feedbackTags: string[];
  overlay: StretchGuideOverlay;
  payload: Omit<StretchEvaluation["payload"], "stretch_name" | "alignment_score" | "hold_ready" | "feedback_tags">;
}): StretchEvaluation {
  return {
    message,
    holdReady,
    alignmentScore: clamp01(alignmentScore),
    feedbackTags,
    overlay,
    payload: {
      stretch_name: stretchName,
      alignment_score: clamp01(alignmentScore),
      hold_ready: holdReady,
      feedback_tags: dedupeTags(feedbackTags),
      ...payload,
    },
  };
}

function makeFallbackEvaluation(
  stretchName: string,
  message: string,
  feedbackTags: string[],
  overlay: StretchGuideOverlay,
): StretchEvaluation {
  return buildEvaluation({
    stretchName,
    message,
    holdReady: false,
    alignmentScore: 0,
    feedbackTags,
    overlay,
    payload: {
      torso_lean: 0,
      arm_lift_score: 0,
      hip_level_score: 0,
      full_body_visible: false,
      direction_matched: false,
    },
  });
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function dedupeTags(tags: string[]) {
  return Array.from(new Set(tags));
}

function pushTag(tags: string[], tag: string) {
  if (!tags.includes(tag)) {
    tags.push(tag);
  }
}

function getBestTemplateMatch<T extends TemplateVariant>(
  landmarks: PoseLandmarkLike[],
  variants: readonly T[],
): { variant: T; score: number } {
  const fallback = variants[0];
  if (!fallback) {
    throw new Error("At least one template variant is required.");
  }

  return variants.reduce(
    (best, variant) => {
      const score = scoreTemplateVariant(landmarks, variant);
      return score > best.score ? { variant, score } : best;
    },
    { variant: fallback, score: 0 },
  );
}

function scoreTemplateVariant(landmarks: PoseLandmarkLike[], variant: TemplateVariant) {
  const frame = buildPoseFrame(landmarks);
  if (!frame) {
    return 0;
  }

  let totalWeight = 0;
  let visibleWeight = 0;
  let weightedScore = 0;

  for (const templatePoint of variant.points) {
    const weight = templatePoint.weight ?? 1;
    totalWeight += weight;

    const landmark = landmarks[LANDMARK_INDEX[templatePoint.name]];
    if (!landmark || (landmark.visibility ?? 1) < 0.18) {
      continue;
    }

    visibleWeight += weight;
    const normalized = normalizeToFrame(landmark, frame);
    const toleranceX = templatePoint.toleranceX ?? 0.46;
    const toleranceY = templatePoint.toleranceY ?? 0.46;
    const error = Math.hypot(
      (normalized.x - templatePoint.x) / toleranceX,
      (normalized.y - templatePoint.y) / toleranceY,
    );
    weightedScore += clamp01(1 - error / 1.3) * weight;
  }

  if (!totalWeight || !visibleWeight) {
    return 0;
  }

  const visibilityScore = clamp01(visibleWeight / totalWeight);
  return clamp01((weightedScore / visibleWeight) * (0.55 + visibilityScore * 0.45));
}

function buildPoseFrame(landmarks: PoseLandmarkLike[]): PoseFrame | null {
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
  const leftHip = landmarks[LANDMARK_INDEX.leftHip];
  const rightHip = landmarks[LANDMARK_INDEX.rightHip];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  const shoulderCenterX = average([leftShoulder.x, rightShoulder.x]);
  const shoulderCenterY = average([leftShoulder.y, rightShoulder.y]);
  const hipCenterX = average([leftHip.x, rightHip.x]);
  const hipCenterY = average([leftHip.y, rightHip.y]);

  return {
    originX: hipCenterX,
    originY: hipCenterY,
    scaleX: Math.max(0.08, Math.abs(leftShoulder.x - rightShoulder.x)),
    scaleY: Math.max(0.14, Math.abs(hipCenterY - shoulderCenterY)),
  };
}

function normalizeToFrame(point: PoseLandmarkLike, frame: PoseFrame) {
  return {
    x: (point.x - frame.originX) / frame.scaleX,
    y: (point.y - frame.originY) / frame.scaleY,
  };
}
