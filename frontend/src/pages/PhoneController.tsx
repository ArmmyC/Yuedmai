import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Clock, Loader2, Pause, Play, RotateCcw, SkipForward, Sparkles, Square } from "lucide-react";

import { Logo } from "@/components/Logo";
import {
  getRoom,
  listRoomRoutines,
  openRoomSocket,
  selectRoomRoutine,
  sendRoomCommand,
} from "@/api.js";
import { hasControllerAccess, normalizeRoomCode } from "@/router.js";

type Routine = {
  id: string;
  name: string;
  duration_seconds: number;
  stretches: string[];
  description: string;
};

type Room = {
  code: string;
  status: string;
  selected_routine?: Routine | null;
  session?: {
    id: string;
    current_index: number;
    current_name?: string | null;
    total_stretches: number;
  } | null;
};

export default function PhoneController() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();
  const code = normalizeRoomCode(roomCode);
  const [room, setRoom] = useState<Room | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState("");
  const [busyCommand, setBusyCommand] = useState("");

  useEffect(() => {
    if (!hasControllerAccess(code)) {
      navigate(`/join/${code}`, { replace: true });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setError("");
        const [roomPayload, routinePayload] = await Promise.all([getRoom(code), listRoomRoutines()]);
        if (!cancelled) {
          setRoom(roomPayload);
          setRoutines(routinePayload.routines ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load this controller.");
        }
      }
    }

    load();
    const socket = openRoomSocket(code, "controller", {
      onRoom: (nextRoom: Room) => setRoom(nextRoom),
      onError: setError,
    });

    return () => {
      cancelled = true;
      socket.close();
    };
  }, [code, navigate]);

  const routine = room?.selected_routine ?? null;
  const stretches = routine?.stretches ?? [];
  const durationMinutes = routine ? Math.max(1, Math.round(routine.duration_seconds / 60)) : 0;
  const isActive = room?.status === "active";
  const isPaused = room?.status === "paused";
  const hasRoutineSelected = Boolean(room?.selected_routine);
  const hasCameraPreview = room?.status === "calibrating" && !room?.session;
  const isCalibrationRunning = room?.status === "calibrating" && Boolean(room?.session);
  const canShowCamera = hasRoutineSelected && (room?.status === "connected" || room?.status === "routine_selected");
  const canStartQuest = hasRoutineSelected && (room?.status === "routine_selected" || hasCameraPreview);
  const canChooseRoutine = room?.status === "connected" || room?.status === "routine_selected";

  const statusText = useMemo(() => {
    if (!room) {
      return "Connecting";
    }
    if (isCalibrationRunning) {
      return "Calibrating";
    }
    if (hasCameraPreview) {
      return "Camera preview";
    }
    if (room.status === "active") {
      return "Quest live";
    }
    if (room.status === "paused") {
      return "Paused";
    }
    if (room.status === "complete") {
      return "Complete";
    }
    return "Connected";
  }, [hasCameraPreview, isCalibrationRunning, room]);

  async function ensureRoutineSelected() {
    if (room?.selected_routine || !routine) {
      return;
    }
    const nextRoom = await selectRoomRoutine(code, routine.id);
    setRoom(nextRoom);
  }

  async function chooseRoutine(nextRoutine: Routine) {
    try {
      setBusyCommand(`routine:${nextRoutine.id}`);
      setError("");
      const nextRoom = await selectRoomRoutine(code, nextRoutine.id);
      setRoom(nextRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select this routine.");
    } finally {
      setBusyCommand("");
    }
  }

  async function runCommand(command: string, label: string, before?: () => Promise<void>) {
    try {
      setBusyCommand(label);
      setError("");
      await before?.();
      const nextRoom = await sendRoomCommand(code, command);
      setRoom(nextRoom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That command could not be sent.");
    } finally {
      setBusyCommand("");
    }
  }

  return (
    <main className="min-h-screen flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col px-5 py-6 gap-5">
        <header className="flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 text-success text-xs">
            <span className="ring-dot" /> {statusText}
          </div>
        </header>

        <div className="panel rounded-3xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Room</div>
            <div className="font-mono text-2xl font-bold tracking-[0.25em] text-primary">{code}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Mode</div>
            <div className="text-sm font-medium">Guest</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Pick a quest</div>
            {routine ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {durationMinutes} min
              </div>
            ) : null}
          </div>

          {routines.map((option) => {
            const selected = room?.selected_routine?.id === option.id;
            const loading = busyCommand === `routine:${option.id}`;
            const optionDurationMinutes = Math.max(1, Math.round(option.duration_seconds / 60));

            return (
              <div
                key={option.id}
                className={`rounded-3xl p-6 border relative overflow-hidden transition-colors ${
                  selected ? "bg-gradient-panel border-primary/35" : "bg-surface/55 border-border"
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_80%_0%,hsl(var(--primary)/0.18),transparent_60%)]" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-md border ${
                        selected ? "bg-primary/15 text-primary border-primary/30" : "bg-background/40 text-muted-foreground border-border"
                      }`}
                    >
                      {selected ? "Selected routine" : "Quest option"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3.5 w-3.5" /> {optionDurationMinutes} min
                    </span>
                  </div>

                  <h2 className="font-display text-2xl font-semibold">{option.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{option.description}</p>

                  <div className="mt-4">
                    {selected ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                        <Sparkles className="h-3.5 w-3.5" /> Routine ready
                      </div>
                    ) : (
                      <button
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-primary/35 bg-primary/10 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={Boolean(busyCommand) || !canChooseRoutine}
                        onClick={() => void chooseRoutine(option)}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Choose this quest
                      </button>
                    )}
                  </div>

                  <ul className="mt-4 space-y-2">
                    {option.stretches.map((stretch, index) => (
                      <li key={stretch} className="flex items-center gap-3 text-sm">
                        <span className="h-6 w-6 rounded-full bg-surface border border-border grid place-items-center text-[11px] font-mono text-muted-foreground">
                          {index + 1}
                        </span>
                        <span>{stretch}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}

        <button
          className="w-full h-14 rounded-2xl border border-primary/40 bg-primary/10 text-primary font-medium flex items-center justify-center gap-2 hover:bg-primary/15 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canShowCamera || Boolean(busyCommand)}
          onClick={() => runCommand("START_CALIBRATION", "calibration", ensureRoutineSelected)}
        >
          {busyCommand === "calibration" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
          Show Camera
        </button>

        <button
          className="w-full h-16 rounded-2xl bg-gradient-primary text-primary-foreground font-display text-lg font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[0.99] transition-transform disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canStartQuest || Boolean(busyCommand)}
          onClick={() => runCommand("START_SESSION", "start", ensureRoutineSelected)}
        >
          {busyCommand === "start" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
          {isCalibrationRunning ? "Starting..." : "Start Quest"}
        </button>

        <div className="grid grid-cols-3 gap-3">
          <ControlButton
            icon={<Pause className="h-5 w-5" />}
            label="Pause"
            disabled={!isActive || Boolean(busyCommand)}
            onClick={() => runCommand("PAUSE_SESSION", "pause")}
          />
          <ControlButton
            icon={<Play className="h-5 w-5" />}
            label="Resume"
            disabled={!isPaused || Boolean(busyCommand)}
            onClick={() => runCommand("RESUME_SESSION", "resume")}
          />
          <ControlButton
            icon={<SkipForward className="h-5 w-5" />}
            label="Next"
            disabled={(!isActive && !isPaused) || Boolean(busyCommand)}
            onClick={() => runCommand("NEXT_STRETCH", "next")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            className="h-12 rounded-2xl border border-border bg-surface/60 text-muted-foreground text-sm font-medium flex items-center justify-center gap-2 hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(busyCommand)}
            onClick={() => runCommand("END_SESSION", "end")}
          >
            <Square className="h-4 w-4" /> End
          </button>
          <button
            className="h-12 rounded-2xl border border-border bg-surface/60 text-muted-foreground text-sm font-medium flex items-center justify-center gap-2 hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            disabled={room?.status !== "complete" && room?.status !== "ended"}
            onClick={() => runCommand("START_ANOTHER_QUEST", "again")}
          >
            <RotateCcw className="h-4 w-4" /> Again
          </button>
        </div>

        <div className="text-center text-[11px] text-muted-foreground pt-2">
          Keep your phone nearby while you move in front of the display.
        </div>
      </div>
    </main>
  );
}

function ControlButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="h-16 rounded-2xl panel flex flex-col items-center justify-center gap-1 hover:border-primary/40 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="text-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
