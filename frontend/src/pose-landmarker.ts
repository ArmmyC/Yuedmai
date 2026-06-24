import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";

const POSE_WASM_ROOT =
  import.meta.env.VITE_MEDIAPIPE_WASM_ROOT ||
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const POSE_MODEL_PATH =
  import.meta.env.VITE_POSE_LANDMARKER_MODEL ||
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

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

const TRACKABLE_CONFIDENCE = 0.55;

export type KioskPoseSignal = {
  visible: boolean;
  centered: boolean;
  confidence: number;
  steady: boolean;
};

export type PoseSample = {
  centerX: number;
  centerY: number;
  shoulderSpan: number;
  hipSpan: number;
  bodyHeight: number;
  upperBodyVisible: boolean;
  fullBodyVisible: boolean;
  timestamp: number;
};

export type PoseAnalysis = {
  signal: KioskPoseSignal;
  sample: PoseSample | null;
  message: string;
};

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

export async function loadPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(POSE_WASM_ROOT);

      try {
        return await createPoseLandmarker(vision, "GPU");
      } catch {
        return createPoseLandmarker(vision, "CPU");
      }
    })();
  }

  return poseLandmarkerPromise;
}

export function analyzePoseResult(
  result: PoseLandmarkerResult,
  previousSample: PoseSample | null,
  timestamp: number,
): PoseAnalysis {
  const landmarks = result.landmarks[0];
  if (!landmarks) {
    return emptyAnalysis("Stand where the camera can see you.");
  }

  const nose = landmarks[LANDMARK_INDEX.nose];
  const leftShoulder = landmarks[LANDMARK_INDEX.leftShoulder];
  const rightShoulder = landmarks[LANDMARK_INDEX.rightShoulder];
  const leftElbow = landmarks[LANDMARK_INDEX.leftElbow];
  const rightElbow = landmarks[LANDMARK_INDEX.rightElbow];
  const leftWrist = landmarks[LANDMARK_INDEX.leftWrist];
  const rightWrist = landmarks[LANDMARK_INDEX.rightWrist];
  const leftHip = landmarks[LANDMARK_INDEX.leftHip];
  const rightHip = landmarks[LANDMARK_INDEX.rightHip];
  const leftKnee = landmarks[LANDMARK_INDEX.leftKnee];
  const rightKnee = landmarks[LANDMARK_INDEX.rightKnee];
  const leftAnkle = landmarks[LANDMARK_INDEX.leftAnkle];
  const rightAnkle = landmarks[LANDMARK_INDEX.rightAnkle];

  if (
    !nose ||
    !leftShoulder ||
    !rightShoulder ||
    !leftElbow ||
    !rightElbow ||
    !leftWrist ||
    !rightWrist ||
    !leftHip ||
    !rightHip ||
    !leftKnee ||
    !rightKnee ||
    !leftAnkle ||
    !rightAnkle
  ) {
    return emptyAnalysis("Stand where the camera can see you.");
  }

  const torsoPoints = [leftShoulder, rightShoulder, leftHip, rightHip];
  const upperBodyPoints = [nose, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist, leftHip, rightHip];
  const lowerBodyPoints = [leftKnee, rightKnee, leftAnkle, rightAnkle];
  const confidence = average([...upperBodyPoints, ...lowerBodyPoints].map((point) => point.visibility));
  const centerX = average(torsoPoints.map((point) => point.x));
  const centerY = average(torsoPoints.map((point) => point.y));
  const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);
  const hipSpan = Math.abs(leftHip.x - rightHip.x);
  const bodyTop = Math.min(nose.y, leftShoulder.y, rightShoulder.y);
  const bodyBottom = Math.max(leftAnkle.y, rightAnkle.y, leftKnee.y, rightKnee.y, leftHip.y, rightHip.y);
  const bodyHeight = bodyBottom - bodyTop;
  const upperBodyVisible = average(upperBodyPoints.map((point) => point.visibility)) >= 0.45;
  const lowerBodyVisible = average(lowerBodyPoints.map((point) => point.visibility)) >= 0.3;
  const fullBodyVisible = upperBodyVisible && lowerBodyVisible && bodyHeight >= 0.36;

  const visible = upperBodyVisible && confidence >= 0.35 && shoulderSpan >= 0.08 && hipSpan >= 0.06;
  const centered = visible && centerX >= 0.28 && centerX <= 0.72 && centerY >= 0.18 && centerY <= 0.82;
  const sample = visible
    ? {
        centerX,
        centerY,
        shoulderSpan,
        hipSpan,
        bodyHeight,
        upperBodyVisible,
        fullBodyVisible,
        timestamp,
      }
    : null;

  let steady = visible;
  if (visible && previousSample && timestamp - previousSample.timestamp < 800) {
    const centerDrift = Math.hypot(centerX - previousSample.centerX, centerY - previousSample.centerY);
    const shoulderDrift = Math.abs(shoulderSpan - previousSample.shoulderSpan);
    const hipDrift = Math.abs(hipSpan - previousSample.hipSpan);

    steady = centerDrift < 0.045 && shoulderDrift < 0.05 && hipDrift < 0.05;
  }

  const signal = {
    visible,
    centered,
    confidence,
    steady,
  };

  return {
    signal,
    sample,
    message: feedbackFromSignal(signal),
  };
}

export function feedbackFromSignal(signal: KioskPoseSignal) {
  if (!signal.visible) {
    return "Stand where the camera can see you.";
  }
  if (!signal.centered) {
    return "Center your shoulders in the frame.";
  }
  if (signal.confidence < 0.45) {
    return "Make sure the area is well lit.";
  }
  if (!signal.steady) {
    return "Hold steady. You are doing great.";
  }
  return "Nice rhythm. Stay calm and hold the pose.";
}

export function feedbackFromTags(tags: string[]) {
  if (tags.includes("step into frame")) {
    return "Stand where the camera can see you.";
  }
  if (tags.includes("center your body")) {
    return "Center your shoulders in the frame.";
  }
  if (tags.includes("show upper body")) {
    return "Show your upper body in the frame.";
  }
  if (tags.includes("show full body")) {
    return "Show your full body in the frame.";
  }
  if (tags.includes("tilt your head gently")) {
    return "Tilt your head gently.";
  }
  if (tags.includes("relax your shoulders")) {
    return "Relax your shoulders.";
  }
  if (tags.includes("open both arms wider")) {
    return "Open both arms wider.";
  }
  if (tags.includes("lift arms to shoulder height")) {
    return "Lift your arms to shoulder height.";
  }
  if (tags.includes("even out both arms")) {
    return "Even out both arms.";
  }
  if (tags.includes("reach one arm up")) {
    return "Reach one arm up.";
  }
  if (tags.includes("lean farther to the side")) {
    return "Lean farther to the side.";
  }
  if (tags.includes("lean away from raised arm")) {
    return "Lean away from your raised arm.";
  }
  if (tags.includes("keep hips level")) {
    return "Keep your hips level.";
  }
  if (tags.includes("reach lower")) {
    return "Reach lower.";
  }
  if (tags.includes("hinge forward a little more")) {
    return "Hinge forward a little more.";
  }
  if (tags.includes("reach toward your shins")) {
    return "Reach toward your shins.";
  }
  if (tags.includes("keep hips even")) {
    return "Keep your hips even.";
  }
  if (tags.includes("hold the shape")) {
    return "Hold the shape.";
  }
  if (tags.includes("improve lighting")) {
    return "Make sure the area is well lit.";
  }
  return "Hold steady. You are doing great.";
}

export function isHoldReady(signal: KioskPoseSignal) {
  return signal.visible && signal.centered && signal.steady && signal.confidence >= TRACKABLE_CONFIDENCE;
}

async function createPoseLandmarker(vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>, delegate: "CPU" | "GPU") {
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_MODEL_PATH,
      delegate,
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
}

function emptyAnalysis(message: string): PoseAnalysis {
  return {
    signal: {
      visible: false,
      centered: false,
      confidence: 0,
      steady: false,
    },
    sample: null,
    message,
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
