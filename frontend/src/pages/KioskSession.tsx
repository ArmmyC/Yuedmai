import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ShieldAlert, Star, Zap } from "lucide-react";

import { Logo } from "@/components/Logo";
import { scoreSession, sendRoomCommand } from "@/api.js";
import { startCamera } from "@/camera.js";
import {
  analyzePoseResult,
  feedbackFromTags,
  isHoldReady,
  loadPoseLandmarker,
  type KioskPoseSignal,
  type PoseSample,
} from "@/pose-landmarker";
import { evaluateStretchPose, type StretchEvaluation, type StretchGuideOverlay } from "@/stretch-evaluator";

type Room = {
  code: string;
  status: string;
  selected_routine?: {
    name: string;
    duration_seconds: number;
    stretches: string[];
  } | null;
  session?: {
    id: string;
    state?: string;
    current_index: number;
    current_name?: string | null;
    total_stretches: number;
    xp_earned: number;
    current_stars: number;
    total_stars: number;
    elapsed_seconds: number;
    feedback_message: string;
  } | null;
};

type ScoredSessionResponse = {
  id: string;
  state: string;
  current_index: number;
  total_score: number;
  xp_earned: number;
  routine: string[];
  segments: Array<{
    name: string;
    score: number;
    stars: number;
    feedback_tags: string[];
  }>;
};

type CalibrationState = {
  prompt: string;
  holdSeconds: number;
  ready: boolean;
  visible: boolean;
  centered: boolean;
  steady: boolean;
  confidenceGood: boolean;
  fullBodyVisible: boolean;
  distance: "good" | "closer" | "back" | "unknown";
  cue: "frame" | "left" | "right" | "up" | "down" | "depth" | "steady" | "light" | "ready";
  tone: "bad" | "good";
};

const ANALYZE_EVERY_MS = 120;
const SCORE_EVERY_MS = 1250;
const CALIBRATION_HOLD_SECONDS = 5;
const SKELETON_CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 32],
] as const;

const DEFAULT_CALIBRATION_STATE: CalibrationState = {
  prompt: "STEP INTO FRAME",
  holdSeconds: 0,
  ready: false,
  visible: false,
  centered: false,
  steady: false,
  confidenceGood: false,
  fullBodyVisible: false,
  distance: "unknown",
  cue: "frame",
  tone: "bad",
};

const CALIBRATION_SUCCESS_FLASH_SECONDS = 0.7;

export default function KioskSession({ room }: { room?: Room }) {
  const session = room?.session ?? null;
  const routine = room?.selected_routine;
  const [liveSession, setLiveSession] = useState<Room["session"] | null>(session);
  const activeSession = liveSession ?? session;
  const current = activeSession ? activeSession.current_index + 1 : 1;
  const total = activeSession?.total_stretches ?? routine?.stretches.length ?? 4;
  const stretchName = activeSession?.current_name ?? routine?.stretches[0] ?? "Get ready";
  const totalSeconds = routine ? Math.max(30, Math.round(routine.duration_seconds / total)) : 30;
  const segmentKey = activeSession ? `${activeSession.id}:${activeSession.current_index}` : "";
  const [segmentElapsedSeconds, setSegmentElapsedSeconds] = useState(() =>
    getInitialSegmentElapsed(session?.elapsed_seconds ?? 0, totalSeconds),
  );
  const previousSegmentKeyRef = useRef("");
  const segmentElapsed = segmentElapsedSeconds;
  const segmentRemaining = Math.max(0, totalSeconds - segmentElapsed);
  const progress = Math.min(100, Math.round((segmentElapsed / totalSeconds) * 100));

  const isPreviewMode = room?.status === "calibrating" && !activeSession;
  const isCalibrationMode = room?.status === "calibrating" && Boolean(activeSession);
  const isQuestLive = room?.status === "active";
  const isQuestPaused = room?.status === "paused";
  const isQuestRest = room?.status === "rest";
  const showQuestHud = isQuestLive || isQuestPaused || isQuestRest;
  const shouldTrackPose = isCalibrationMode || showQuestHud;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const previousSampleRef = useRef<PoseSample | null>(null);
  const scoreHoldStartedAtRef = useRef<number | null>(null);
  const calibrationHoldStartedAtRef = useRef<number | null>(null);
  const scorePendingRef = useRef(false);
  const activationPendingRef = useRef(false);
  const advancePendingRef = useRef(false);
  const lastAutoAdvancedSegmentKeyRef = useRef("");
  const lastScoredAtRef = useRef(0);
  const activeSessionRef = useRef<{ id: string; currentIndex: number } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [poseMessage, setPoseMessage] = useState("");
  const [poseSignal, setPoseSignal] = useState<KioskPoseSignal | null>(null);
  const [overlayFrame, setOverlayFrame] = useState({ width: 960, height: 540 });
  const [overlayViewport, setOverlayViewport] = useState({ width: 0, height: 0 });
  const [skeletonPoints, setSkeletonPoints] = useState<Array<{ x: number; y: number; visibility: number }>>([]);
  const [calibrationState, setCalibrationState] = useState<CalibrationState>(DEFAULT_CALIBRATION_STATE);
  const [stretchEvaluation, setStretchEvaluation] = useState<StretchEvaluation | null>(null);

  useEffect(() => {
    setLiveSession(session);
  }, [room?.status, session?.id, session?.current_index, session?.current_name, session?.xp_earned, session?.total_stars]);

  useEffect(() => {
    if (!activeSession) {
      previousSegmentKeyRef.current = "";
      setSegmentElapsedSeconds(0);
      return;
    }

    const currentKey = `${activeSession.id}:${activeSession.current_index}`;
    const previousKey = previousSegmentKeyRef.current;
    const initialElapsed = getInitialSegmentElapsed(activeSession.elapsed_seconds ?? 0, totalSeconds);

    if (!previousKey) {
      setSegmentElapsedSeconds(initialElapsed);
    } else if (currentKey !== previousKey) {
      const [previousSessionId] = previousKey.split(":");
      setSegmentElapsedSeconds(previousSessionId === activeSession.id ? 0 : initialElapsed);
    } else {
      setSegmentElapsedSeconds((currentValue) => Math.max(currentValue, initialElapsed));
    }

    previousSegmentKeyRef.current = currentKey;
  }, [activeSession?.id, activeSession?.current_index, activeSession?.elapsed_seconds, totalSeconds]);

  useEffect(() => {
    if (!isQuestLive || !segmentKey) {
      advancePendingRef.current = false;
      return;
    }

    const timer = window.setInterval(() => {
      setSegmentElapsedSeconds((currentValue) => Math.min(totalSeconds, currentValue + 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isQuestLive, segmentKey, totalSeconds]);

  useEffect(() => {
    if (lastAutoAdvancedSegmentKeyRef.current !== segmentKey) {
      advancePendingRef.current = false;
    }
  }, [segmentKey]);

  useEffect(() => {
    if (!isQuestLive || !room?.code || !activeSession || !segmentKey || segmentElapsed < totalSeconds) {
      return;
    }
    if (advancePendingRef.current || lastAutoAdvancedSegmentKeyRef.current === segmentKey) {
      return;
    }

    advancePendingRef.current = true;
    lastAutoAdvancedSegmentKeyRef.current = segmentKey;

    void sendRoomCommand(room.code, "NEXT_STRETCH").catch(() => {
      advancePendingRef.current = false;
      lastAutoAdvancedSegmentKeyRef.current = "";
      setPoseMessage("Next stretch is on the way. If it stalls, tap Next on your phone.");
    });
  }, [activeSession, isQuestLive, room?.code, segmentElapsed, segmentKey, totalSeconds]);

  useEffect(() => {
    if (!activeSession?.id) {
      activeSessionRef.current = null;
      return;
    }

    activeSessionRef.current = {
      id: activeSession.id,
      currentIndex: activeSession.current_index,
    };
  }, [activeSession?.id, activeSession?.current_index]);

  useEffect(() => {
    if (!isCalibrationMode) {
      calibrationHoldStartedAtRef.current = null;
      activationPendingRef.current = false;
      setCalibrationState(DEFAULT_CALIBRATION_STATE);
    }

    if (!isQuestLive) {
      scoreHoldStartedAtRef.current = null;
    }
  }, [isCalibrationMode, isQuestLive, activeSession?.id, activeSession?.current_index]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setOverlayViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(overlay);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cancelled = false;
    let localStream: MediaStream | null = null;

    async function bootCamera() {
      try {
        setCameraError("");
        localStream = await startCamera(video);
        if (cancelled) {
          localStream.getTracks().forEach((track) => track.stop());
          return;
        }
        setCameraReady(true);
      } catch (error) {
        if (!cancelled) {
          setCameraError(error instanceof Error ? error.message : "Camera access is unavailable.");
          setCameraReady(false);
        }
      }
    }

    bootCamera();

    return () => {
      cancelled = true;
      setCameraReady(false);
      localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraReady || !shouldTrackPose) {
      if (!shouldTrackPose) {
        previousSampleRef.current = null;
        setPoseSignal(null);
        setSkeletonPoints([]);
        setStretchEvaluation(null);
      }
      return;
    }

    let cancelled = false;
    let animationFrameId: number | null = null;
    let lastAnalyzedAt = 0;

    async function maybeScoreActiveSession(
      signal: KioskPoseSignal,
      holdSeconds: number,
      evaluation: StretchEvaluation | null,
    ) {
      const currentSession = activeSessionRef.current;
      if (!isQuestLive || !currentSession || scorePendingRef.current) {
        return;
      }
      if (performance.now() - lastScoredAtRef.current < SCORE_EVERY_MS) {
        return;
      }

      scorePendingRef.current = true;
      lastScoredAtRef.current = performance.now();

      try {
        const nextSession = (await scoreSession(currentSession.id, {
          ...signal,
          hold_seconds: holdSeconds,
          ...(evaluation?.payload ?? {}),
        })) as ScoredSessionResponse;

        if (cancelled) {
          return;
        }

        const latestSession = activeSessionRef.current;
        if (!latestSession || nextSession.id !== latestSession.id || nextSession.current_index !== latestSession.currentIndex) {
          return;
        }

        setLiveSession((currentValue) =>
          mapScoredSession(nextSession, currentValue?.elapsed_seconds ?? activeSession?.elapsed_seconds ?? 0),
        );

        const currentSegment = nextSession.segments[nextSession.current_index];
        if (currentSegment) {
          setPoseMessage(feedbackFromTags(currentSegment.feedback_tags));
        }
      } catch {
        if (!cancelled) {
          setPoseMessage("Tracking is live. Waiting for the next score update.");
        }
      } finally {
        scorePendingRef.current = false;
      }
    }

    async function maybeBeginActiveSession(holdSeconds: number) {
      if (!room?.code || !isCalibrationMode || activationPendingRef.current || holdSeconds < CALIBRATION_HOLD_SECONDS) {
        return;
      }

      activationPendingRef.current = true;
      try {
        await sendRoomCommand(room.code, "BEGIN_ACTIVE_SESSION");
      } catch {
        activationPendingRef.current = false;
      }
    }

    async function bootTracking() {
      try {
        const poseLandmarker = await loadPoseLandmarker();
        if (cancelled) {
          return;
        }

        const tick = (now: number) => {
          if (cancelled) {
            return;
          }

          if (video.readyState >= 2 && now - lastAnalyzedAt >= ANALYZE_EVERY_MS) {
            lastAnalyzedAt = now;

            const result = poseLandmarker.detectForVideo(video, now);
            const analysis = analyzePoseResult(result, previousSampleRef.current, now);
            const nextStretchEvaluation =
              showQuestHud && activeSessionRef.current
                ? evaluateStretchPose(
                    stretchName,
                    result.landmarks[0],
                    analysis.signal,
                    analysis.sample,
                  )
                : null;
            previousSampleRef.current = analysis.sample;
            setPoseSignal(analysis.signal);
            setStretchEvaluation(nextStretchEvaluation);
            setOverlayFrame({
              width: video.videoWidth || 960,
              height: video.videoHeight || 540,
            });
            setSkeletonPoints(
              (result.landmarks[0] ?? []).map((point) => ({
                x: point.x * (video.videoWidth || 960),
                y: point.y * (video.videoHeight || 540),
                visibility: point.visibility ?? 0,
              })),
            );

            if (isCalibrationMode) {
              const nextCalibrationState = buildCalibrationState(
                analysis.signal,
                analysis.sample,
                calibrationHoldStartedAtRef.current,
                now,
              );

              if (nextCalibrationState.ready) {
                calibrationHoldStartedAtRef.current ??= now;
                nextCalibrationState.holdSeconds = (now - calibrationHoldStartedAtRef.current) / 1000;
              } else {
                calibrationHoldStartedAtRef.current = null;
                activationPendingRef.current = false;
                nextCalibrationState.holdSeconds = 0;
              }

              setCalibrationState(nextCalibrationState);
              setPoseMessage(nextCalibrationState.prompt);
              void maybeBeginActiveSession(nextCalibrationState.holdSeconds);
            } else if (showQuestHud) {
              setPoseMessage(nextStretchEvaluation?.message ?? analysis.message);

              const holdReady = nextStretchEvaluation?.holdReady ?? isHoldReady(analysis.signal);

              if (isQuestLive && holdReady) {
                scoreHoldStartedAtRef.current ??= now;
              } else {
                scoreHoldStartedAtRef.current = null;
              }

              const holdSeconds =
                scoreHoldStartedAtRef.current === null ? 0 : (now - scoreHoldStartedAtRef.current) / 1000;
              void maybeScoreActiveSession(analysis.signal, holdSeconds, nextStretchEvaluation);
            }
          }

          animationFrameId = window.requestAnimationFrame(tick);
        };

        animationFrameId = window.requestAnimationFrame(tick);
      } catch (error) {
        if (!cancelled) {
          setCameraError(error instanceof Error ? error.message : "Pose tracking is unavailable.");
        }
      }
    }

    bootTracking();

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [cameraReady, isCalibrationMode, isQuestLive, room?.code, shouldTrackPose, showQuestHud, stretchName]);

  const roomStatus = useMemo(() => {
    if (cameraError) {
      return "Camera unavailable";
    }
    if (!cameraReady) {
      return "Camera loading";
    }
    if (isPreviewMode) {
      return "Camera preview";
    }
    if (isCalibrationMode) {
      return "Camera check";
    }
    if (isQuestPaused) {
      return "Paused";
    }
    if (showQuestHud) {
      return "Quest live";
    }
    return "Connected";
  }, [cameraError, cameraReady, isCalibrationMode, isPreviewMode, isQuestPaused, showQuestHud]);

  const liveFeedback = cameraError
    ? cameraError
    : poseMessage || activeSession?.feedback_message || "Stand where the camera can see you.";
  const questCoachTitle = stretchEvaluation?.holdReady
    ? "Locked in."
    : stretchEvaluation
      ? stretchEvaluation.alignmentScore >= 0.68
        ? "Almost there."
        : stretchEvaluation.alignmentScore >= 0.42
          ? "Match the guide."
          : "Keep shaping."
      : poseSignal?.steady
        ? "Nice rhythm."
        : "Keep adjusting.";
  const questCoachBody = stretchEvaluation?.message
    ? `${stretchEvaluation.message}.`
    : poseSignal?.centered
      ? "Stay calm and hold the pose."
      : "Center yourself and slow down.";

  const confidence = Math.max(0, Math.min(100, Math.round((poseSignal?.confidence ?? 0.72) * 100)));
  const progressStroke = 97.4;
  const progressOffset = progressStroke - (progress / 100) * progressStroke;
  const activeStretchOverlay = showQuestHud ? stretchEvaluation?.overlay ?? null : null;
  const skeletonContainBox = computeContainBox(
    overlayViewport.width,
    overlayViewport.height,
    overlayFrame.width,
    overlayFrame.height,
  );

  return (
    <main className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,hsl(var(--primary)/0.12),transparent_60%)]" />
      <div className="absolute inset-0 grid-bg opacity-20" />

      <div ref={overlayRef} className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,hsl(240_30%_7%),hsl(240_24%_5%))]">
        <video
          ref={videoRef}
          className={`h-full w-full object-contain ${cameraReady ? "opacity-100" : "opacity-0"}`}
          autoPlay
          muted
          playsInline
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-transparent to-background/60 pointer-events-none" />
        {isCalibrationMode ? <CalibrationEdgeCoach state={calibrationState} /> : null}
        {activeStretchOverlay && activeStretchOverlay.kind !== "none" ? (
          <StretchGuideLayer
            overlay={activeStretchOverlay}
            frameWidth={overlayFrame.width}
            frameHeight={overlayFrame.height}
            containBox={skeletonContainBox}
          />
        ) : null}

        {cameraReady && skeletonPoints.length && !isPreviewMode ? (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: skeletonContainBox.offsetX,
              top: skeletonContainBox.offsetY,
              width: skeletonContainBox.width,
              height: skeletonContainBox.height,
            }}
            viewBox={`0 0 ${overlayFrame.width} ${overlayFrame.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {SKELETON_CONNECTIONS.map(([from, to]) => {
              const start = skeletonPoints[from];
              const end = skeletonPoints[to];
              if (!start || !end || start.visibility < 0.45 || end.visibility < 0.45) {
                return null;
              }

              return (
                <line
                  key={`${from}-${to}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="hsl(var(--primary))"
                  strokeOpacity="0.92"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              );
            })}

            {skeletonPoints.map((point, index) =>
              point.visibility >= 0.45 ? (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  fill="hsl(var(--accent))"
                  fillOpacity="0.95"
                  stroke="hsl(var(--background))"
                  strokeOpacity="0.6"
                  strokeWidth="2"
                />
              ) : null,
            )}
          </svg>
        ) : null}

        {!cameraReady ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.22),transparent_35%),linear-gradient(180deg,hsl(240_26%_10%/0.92),hsl(240_32%_6%/0.96))]">
            <div className="text-center px-8">
              <div className="mx-auto h-24 w-24 rounded-[2rem] border border-primary/35 bg-background/30 backdrop-blur-xl grid place-items-center shadow-[0_0_80px_hsl(var(--primary)/0.2)]">
                {cameraError ? <ShieldAlert className="h-10 w-10 text-destructive" /> : <Camera className="h-10 w-10 text-primary" />}
              </div>
              <div className="mt-6 font-display text-[clamp(2.4rem,5vw,4.8rem)] font-semibold leading-none">
                {cameraError ? "Camera blocked" : "Show camera"}
              </div>
              <p className="mt-4 text-[clamp(1rem,1.4vw,1.2rem)] text-muted-foreground max-w-2xl">
                {cameraError || "Using the laptop camera so this screen can guide your stretch in real time."}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            {!isPreviewMode ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/50 backdrop-blur-md border border-border text-xs">
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">{roomStatus}</span>
                {showQuestHud ? (
                  <span className={poseSignal?.steady ? "ring-dot" : "h-2 w-2 rounded-full bg-muted-foreground/50"} />
                ) : null}
              </div>
            ) : null}
          </div>

          {showQuestHud || isPreviewMode ? (
            <div className="absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2 pointer-events-none">
              {isPreviewMode ? (
                <div className="rounded-full border border-border bg-background/45 px-5 py-2.5 backdrop-blur-xl text-sm text-muted-foreground shadow-[0_0_30px_rgba(5,10,24,0.35)]">
                  Camera preview live
                </div>
              ) : (
                <>
                  <HUDPill label="XP" value={`+${activeSession?.xp_earned ?? 0}`} icon={<Zap className="h-4 w-4 text-xp" />} />
                  <HUDPill label="Stars" value={`${activeSession?.total_stars ?? 0}`} icon={<Star className="h-4 w-4 text-xp fill-xp" />} />
                </>
              )}
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full bg-background/40 backdrop-blur-md border border-border font-mono">
            {room?.code}
          </div>
        </header>

        {isCalibrationMode ? (
          <div className="absolute inset-0 z-20 px-8 text-center pointer-events-none">
            {calibrationState.ready ? (
              calibrationState.holdSeconds < CALIBRATION_SUCCESS_FLASH_SECONDS ? (
                <div className="absolute inset-x-0 top-28 flex justify-center">
                  <div className="rounded-full border border-emerald-200/20 bg-background/44 px-[clamp(1.6rem,3vw,2.8rem)] py-[clamp(0.75rem,1.6vh,1rem)] shadow-[0_0_50px_rgba(5,10,24,0.48)] backdrop-blur-2xl">
                    <div className="font-display text-gradient text-[clamp(2.4rem,4vw,4.5rem)] font-semibold uppercase tracking-[0.05em] drop-shadow-[0_0_24px_rgba(94,234,212,0.18)]">
                      LOCKED IN
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="font-mono text-[clamp(5rem,12vw,13rem)] font-semibold tracking-[0.12em] leading-none text-foreground drop-shadow-[0_0_30px_rgba(255,255,255,0.18)] animate-[countPop_0.35s_ease-out]">
                    {formatCalibrationCountdown(
                      calibrationState.holdSeconds,
                      CALIBRATION_HOLD_SECONDS,
                      CALIBRATION_SUCCESS_FLASH_SECONDS,
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="absolute inset-x-0 top-24 flex justify-center">
                <div
                  key={calibrationState.prompt}
                  className="flex min-h-[clamp(6.5rem,10vh,9rem)] items-center justify-center rounded-[2rem] border bg-background/34 px-[clamp(1.5rem,3vw,2.8rem)] py-[clamp(0.85rem,1.8vh,1.3rem)] shadow-[0_30px_90px_-35px_rgba(5,10,24,0.9)] backdrop-blur-2xl animate-[coachRise_0.32s_var(--ease-out-soft)]"
                  style={getCalibrationPromptStyle(calibrationState)}
                >
                  <div className="font-display text-[clamp(3rem,6vw,6rem)] font-semibold uppercase tracking-[-0.04em] leading-[0.94] text-slate-50 drop-shadow-[0_0_24px_rgba(0,0,0,0.45)]">
                    {calibrationState.prompt}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div
          className={`absolute left-8 top-1/2 -translate-y-1/2 max-w-[260px] hidden lg:block transition-all duration-700 ${
            showQuestHud ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6 pointer-events-none"
          }`}
        >
          <div className="panel rounded-2xl p-4 flex items-start gap-3 backdrop-blur-xl bg-background/50">
            <Star className="h-5 w-5 text-xp fill-xp flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">{questCoachTitle}</span>{" "}
              {questCoachBody}
            </p>
          </div>
        </div>

        <div
          className={`absolute right-8 top-1/2 -translate-y-1/2 hidden lg:block transition-all duration-700 ${
            showQuestHud ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6 pointer-events-none"
          }`}
        >
          <div className="panel rounded-2xl p-4 backdrop-blur-xl bg-background/50 w-[220px]">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-xl bg-xp/20 border border-xp/40 grid place-items-center">
                <Zap className="h-4 w-4 text-xp" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Quest</div>
                <div className="font-display text-sm">{routine?.name ?? "Quick Reset"}</div>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: total }, (_, index) => (
                <div
                  key={index}
                  className={`h-2 flex-1 rounded-full ${
                    index < current ? "bg-gradient-primary" : "bg-surface border border-border"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {showQuestHud ? (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-background/60 backdrop-blur-xl border border-primary/40 text-primary font-display text-sm shadow-[0_0_30px_hsl(var(--primary)/0.3)] transition-all duration-700">
            {isQuestPaused ? "Paused from phone." : liveFeedback}
          </div>
        ) : null}

        <div
          className={`mt-auto px-8 pb-8 transition-all duration-700 ${
            showQuestHud ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
          }`}
        >
          <div className="mx-auto max-w-3xl mb-3 flex justify-end">
            <div className="rounded-full px-4 py-2 flex items-center gap-2.5 bg-background/50 backdrop-blur-md border border-border">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Camera</span>
              <span className="font-mono text-sm font-semibold">{confidence}%</span>
            </div>
          </div>

          <div className="mx-auto max-w-3xl panel rounded-2xl px-6 py-4 backdrop-blur-xl bg-background/60 flex items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Now stretching</div>
              <h2 className="font-display text-2xl font-semibold truncate">
                {stretchName} <span className="font-mono text-lg text-primary/90 align-middle">{current}/{total}</span>
              </h2>
            </div>

            <div className="h-12 w-px bg-border" />

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Left</div>
                <div className="font-mono text-3xl font-bold text-gradient leading-none">{formatSeconds(segmentRemaining)}</div>
              </div>
              <div className="relative h-14 w-14">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeDasharray={progressStroke}
                    strokeDashoffset={progressOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-[10px] font-mono text-muted-foreground">
                  /{totalSeconds}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-3xl mt-3 h-1.5 rounded-full bg-surface/80 overflow-hidden border border-border">
            <div className="h-full bg-gradient-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </main>
  );
}

function HUDPill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-full px-4 py-2 flex items-center gap-2.5 bg-background/50 backdrop-blur-md border border-border">
      {icon}
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function getInitialSegmentElapsed(elapsedSeconds: number, totalSeconds: number) {
  if (totalSeconds <= 0) {
    return 0;
  }

  const boundedElapsed = Math.max(0, Math.floor(elapsedSeconds));
  return Math.min(totalSeconds, boundedElapsed % totalSeconds);
}

function formatCalibrationCountdown(holdSeconds: number, totalSeconds: number, flashSeconds: number) {
  const countdownProgress = Math.max(0, holdSeconds - flashSeconds);
  const countdownWindow = Math.max(1, totalSeconds - flashSeconds);
  const remaining = countdownWindow - countdownProgress;
  return Math.max(1, Math.ceil(remaining)).toString();
}

function mapScoredSession(session: ScoredSessionResponse, elapsedSeconds: number): NonNullable<Room["session"]> {
  const currentSegment = session.segments[session.current_index] ?? session.segments[0];

  return {
    id: session.id,
    state: session.state,
    current_index: session.current_index,
    current_name: currentSegment?.name ?? session.routine[session.current_index] ?? null,
    total_stretches: session.routine.length,
    xp_earned: session.xp_earned,
    current_stars: currentSegment?.stars ?? 0,
    total_stars: session.segments.reduce((sum, segment) => sum + segment.stars, 0),
    elapsed_seconds: elapsedSeconds,
    feedback_message: feedbackFromTags(currentSegment?.feedback_tags ?? []),
  };
}

function buildCalibrationState(
  signal: KioskPoseSignal,
  sample: PoseSample | null,
  holdStartedAt: number | null,
  now: number,
): CalibrationState {
  const distance = getDistanceHint(sample);
  const confidenceGood = signal.confidence >= 0.55;
  const fullBodyVisible = sample?.fullBodyVisible ?? false;
  const ready = signal.visible && signal.centered && signal.steady && confidenceGood && distance === "good" && fullBodyVisible;
  const centerCue = getCenterCue(sample);

  let prompt = "STEP INTO FRAME";
  let cue: CalibrationState["cue"] = "frame";
  let tone: CalibrationState["tone"] = "bad";
  if (!signal.visible) {
    prompt = "STEP INTO FRAME";
    cue = "frame";
  } else if (distance === "back") {
    prompt = "STEP BACK";
    cue = "depth";
  } else if (distance === "closer") {
    prompt = "STEP CLOSER";
    cue = "depth";
  } else if (!signal.centered) {
    prompt =
      centerCue === "left"
        ? "MOVE LEFT"
        : centerCue === "right"
          ? "MOVE RIGHT"
          : centerCue === "up"
            ? "MOVE UP"
            : centerCue === "down"
              ? "MOVE DOWN"
              : "CENTER";
    cue = centerCue ?? "frame";
  } else if (!confidenceGood) {
    prompt = "MORE LIGHT";
    cue = "light";
  } else if (!fullBodyVisible) {
    prompt = "SHOW FULL BODY";
    cue = "frame";
  } else if (!signal.steady) {
    prompt = "HOLD STILL";
    cue = "steady";
  } else {
    prompt = "LOCKED IN";
    cue = "ready";
    tone = "good";
  }

  return {
    prompt,
    holdSeconds: ready && holdStartedAt !== null ? (now - holdStartedAt) / 1000 : 0,
    ready,
    visible: signal.visible,
    centered: signal.centered,
    steady: signal.steady,
    confidenceGood,
    fullBodyVisible,
    distance,
    cue,
    tone,
  };
}

function getDistanceHint(sample: PoseSample | null): CalibrationState["distance"] {
  if (!sample) {
    return "unknown";
  }

  const { bodyHeight, shoulderSpan } = sample;

  if (bodyHeight > 0.94 || (bodyHeight > 0.86 && shoulderSpan > 0.48)) {
    return "back";
  }
  if (bodyHeight < 0.36 || (bodyHeight < 0.42 && shoulderSpan < 0.16)) {
    return "closer";
  }
  return "good";
}

function getCenterCue(sample: PoseSample | null): Exclude<CalibrationState["cue"], "frame" | "depth" | "steady" | "light" | "ready"> | null {
  if (!sample) {
    return null;
  }

  const leftDelta = 0.28 - sample.centerX;
  const rightDelta = sample.centerX - 0.72;
  const topDelta = 0.18 - sample.centerY;
  const bottomDelta = sample.centerY - 0.82;
  const deltas = [
    { cue: "right" as const, delta: leftDelta },
    { cue: "left" as const, delta: rightDelta },
    { cue: "down" as const, delta: topDelta },
    { cue: "up" as const, delta: bottomDelta },
  ].filter((entry) => entry.delta > 0);

  if (!deltas.length) {
    return null;
  }

  return deltas.sort((a, b) => b.delta - a.delta)[0]?.cue ?? null;
}

function getCalibrationPromptStyle(state: CalibrationState) {
  const tone = getCalibrationToneColors(state);
  return {
    borderColor: tone.border,
    boxShadow: `0 0 0 1px ${tone.border} inset, 0 30px 90px -35px rgba(5,10,24,0.9), 0 0 40px ${tone.glow}`,
  };
}

function CalibrationEdgeCoach({ state }: { state: CalibrationState }) {
  const tone = getCalibrationToneColors(state);
  const edges = getCalibrationActiveEdges(state);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div
        className="absolute inset-0 opacity-90 transition-[box-shadow] duration-300 anim-coach-glow"
        style={{ boxShadow: buildCalibrationEdgeShadow(edges, tone.glow) }}
      />
      <div
        className="absolute inset-[1rem] rounded-[2rem] border transition-colors duration-300"
        style={{
          borderColor: tone.border,
          boxShadow: `0 0 0 1px ${tone.border} inset${state.ready ? `, 0 0 44px ${tone.glow}` : ""}`,
        }}
      />
    </div>
  );
}

function getCalibrationActiveEdges(state: CalibrationState) {
  switch (state.cue) {
    case "left":
      return ["left"];
    case "right":
      return ["right"];
    case "up":
      return ["top"];
    case "down":
      return ["bottom"];
    case "depth":
    case "frame":
    case "steady":
    case "light":
    case "ready":
    default:
      return ["top", "right", "bottom", "left"];
  }
}

function getCalibrationToneColors(state: CalibrationState) {
  if (state.ready) {
    return {
      glow: "rgba(34, 197, 94, 0.42)",
      border: "rgba(110, 231, 183, 0.52)",
    };
  }

  if (state.cue === "light") {
    return {
      glow: "rgba(250, 204, 21, 0.28)",
      border: "rgba(250, 204, 21, 0.38)",
    };
  }

  return {
    glow: "rgba(45, 212, 191, 0.28)",
    border: "rgba(45, 212, 191, 0.34)",
  };
}

function buildCalibrationEdgeShadow(edges: string[], glow: string) {
  const shadows: string[] = [];

  if (edges.includes("top")) {
    shadows.push(`inset 0 9rem 7rem -6rem ${glow}`);
  }
  if (edges.includes("bottom")) {
    shadows.push(`inset 0 -9rem 7rem -6rem ${glow}`);
  }
  if (edges.includes("left")) {
    shadows.push(`inset 9rem 0 7rem -6rem ${glow}`);
  }
  if (edges.includes("right")) {
    shadows.push(`inset -9rem 0 7rem -6rem ${glow}`);
  }

  return shadows.join(", ");
}

function StretchGuideLayer({
  overlay,
  frameWidth,
  frameHeight,
  containBox,
}: {
  overlay: Exclude<StretchGuideOverlay, { kind: "none" }>;
  frameWidth: number;
  frameHeight: number;
  containBox: { width: number; height: number; offsetX: number; offsetY: number };
}) {
  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        left: containBox.offsetX,
        top: containBox.offsetY,
        width: containBox.width,
        height: containBox.height,
      }}
      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {overlay.kind === "standing-side-bend"
        ? (
          <>
            {renderSideBendGhost({
              side: "left",
              active: overlay.targetSide === "left" || overlay.targetSide === "both",
              aligned: overlay.aligned,
              width: frameWidth,
              height: frameHeight,
            })}
            {renderSideBendGhost({
              side: "right",
              active: overlay.targetSide === "right" || overlay.targetSide === "both",
              aligned: overlay.aligned,
              width: frameWidth,
              height: frameHeight,
            })}
          </>
        )
        : null}
      {overlay.kind === "neck-reset"
        ? renderNeckResetGuide({
            targetSide: overlay.targetSide,
            aligned: overlay.aligned,
            width: frameWidth,
            height: frameHeight,
          })
        : null}
      {overlay.kind === "shoulder-opener"
        ? renderShoulderOpenerGuide({
            aligned: overlay.aligned,
            width: frameWidth,
            height: frameHeight,
          })
        : null}
      {overlay.kind === "hamstring-reach"
        ? renderHamstringReachGuide({
            aligned: overlay.aligned,
            width: frameWidth,
            height: frameHeight,
          })
        : null}
    </svg>
  );
}

function renderNeckResetGuide({
  targetSide,
  aligned,
  width,
  height,
}: {
  targetSide: "left" | "right" | "both";
  aligned: boolean;
  width: number;
  height: number;
}) {
  const centerX = width * 0.5;
  const headY = height * 0.22;
  const radius = width * 0.08;

  return (
    <>
      {(["left", "right"] as const).map((side) => {
        const active = targetSide === "both" || targetSide === side;
        const tone = getGuideTone(active, aligned);
        const direction = side === "left" ? -1 : 1;
        return (
          <g key={side} opacity={tone.opacity}>
            <path
              d={`M ${centerX + radius * -0.2} ${headY + radius * 0.2}
                  Q ${centerX + direction * radius * 0.85} ${headY + radius * 0.2}
                    ${centerX + direction * radius * 0.95} ${headY + radius * 1.15}`}
              fill="none"
              stroke={tone.stroke}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={active ? "0" : "12 14"}
            />
            <circle
              cx={centerX + direction * radius * 0.88}
              cy={headY + radius * 1.12}
              r={active ? 12 : 10}
              fill={tone.fill}
              stroke={tone.stroke}
              strokeWidth="3"
            />
          </g>
        );
      })}
    </>
  );
}

function renderShoulderOpenerGuide({
  aligned,
  width,
  height,
}: {
  aligned: boolean;
  width: number;
  height: number;
}) {
  const tone = getGuideTone(true, aligned);
  const centerX = width * 0.5;
  const shoulderY = height * 0.34;
  const handOffset = width * 0.22;

  return (
    <g opacity={tone.opacity}>
      <line
        x1={centerX - handOffset}
        y1={shoulderY}
        x2={centerX + handOffset}
        y2={shoulderY}
        stroke={tone.stroke}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="18 14"
      />
      <line
        x1={centerX}
        y1={shoulderY - height * 0.08}
        x2={centerX}
        y2={shoulderY + height * 0.12}
        stroke={tone.stroke}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx={centerX - handOffset} cy={shoulderY} r="16" fill={tone.fill} stroke={tone.stroke} strokeWidth="4" />
      <circle cx={centerX + handOffset} cy={shoulderY} r="16" fill={tone.fill} stroke={tone.stroke} strokeWidth="4" />
    </g>
  );
}

function renderSideBendGhost({
  side,
  active,
  aligned,
  width,
  height,
}: {
  side: "left" | "right";
  active: boolean;
  aligned: boolean;
  width: number;
  height: number;
}) {
  const bend = side === "left" ? -1 : 1;
  const midX = width * 0.5;
  const hipY = height * 0.64;
  const shoulderY = height * 0.34;
  const torsoX = midX + width * 0.08 * bend;
  const handX = midX + width * 0.16 * bend;
  const handY = height * 0.14;
  const tone = aligned
    ? {
        stroke: "rgba(110, 231, 183, 0.78)",
        fill: "rgba(110, 231, 183, 0.14)",
        opacity: active ? 0.95 : 0.3,
      }
    : {
        stroke: "rgba(94, 234, 212, 0.62)",
        fill: "rgba(94, 234, 212, 0.1)",
        opacity: active ? 0.82 : 0.2,
      };

  return (
    <g opacity={tone.opacity}>
      <path
        d={`M ${midX} ${hipY}
            Q ${midX + width * 0.03 * bend} ${height * 0.5}
              ${torsoX} ${shoulderY}
            Q ${torsoX + width * 0.03 * bend} ${height * 0.24}
              ${handX} ${handY}`}
        fill="none"
        stroke={tone.stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={active ? "0" : "14 16"}
      />
      <path
        d={`M ${midX - width * 0.04} ${hipY + height * 0.02}
            Q ${midX} ${hipY - height * 0.04}
              ${midX + width * 0.04} ${hipY + height * 0.02}`}
        fill="none"
        stroke={tone.stroke}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle
        cx={handX}
        cy={handY}
        r={active ? 18 : 14}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth="4"
      />
    </g>
  );
}

function renderHamstringReachGuide({
  aligned,
  width,
  height,
}: {
  aligned: boolean;
  width: number;
  height: number;
}) {
  const tone = getGuideTone(true, aligned);
  const centerX = width * 0.5;
  const hipY = height * 0.48;
  const targetY = height * 0.68;

  return (
    <g opacity={tone.opacity}>
      <path
        d={`M ${centerX} ${hipY}
            Q ${centerX - width * 0.02} ${height * 0.57}
              ${centerX} ${targetY}`}
        fill="none"
        stroke={tone.stroke}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="16 12"
      />
      <rect
        x={centerX - width * 0.09}
        y={targetY - height * 0.03}
        width={width * 0.18}
        height={height * 0.06}
        rx="20"
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth="4"
      />
    </g>
  );
}

function getGuideTone(active: boolean, aligned: boolean) {
  if (aligned) {
    return {
      stroke: "rgba(110, 231, 183, 0.82)",
      fill: "rgba(110, 231, 183, 0.14)",
      opacity: active ? 0.96 : 0.32,
    };
  }

  return {
    stroke: active ? "rgba(94, 234, 212, 0.66)" : "rgba(94, 234, 212, 0.32)",
    fill: active ? "rgba(94, 234, 212, 0.1)" : "rgba(94, 234, 212, 0.04)",
    opacity: active ? 0.84 : 0.24,
  };
}

function computeContainBox(containerWidth: number, containerHeight: number, sourceWidth: number, sourceHeight: number) {
  if (!containerWidth || !containerHeight || !sourceWidth || !sourceHeight) {
    return {
      width: containerWidth,
      height: containerHeight,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    width,
    height,
    offsetX: (containerWidth - width) / 2,
    offsetY: (containerHeight - height) / 2,
  };
}
