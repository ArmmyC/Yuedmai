import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Loader2, RotateCcw, Sparkles } from "lucide-react";

import { Logo } from "@/components/Logo";
import KioskComplete from "@/pages/KioskComplete";
import KioskSession from "@/pages/KioskSession";
import { createRoom, getRoom, openRoomSocket } from "@/api.js";

type Room = {
  code: string;
  status: string;
  join_path: string;
  display_path: string;
  selected_routine?: {
    id: string;
    name: string;
    duration_seconds: number;
    stretches: string[];
    description: string;
  } | null;
  session?: {
    id: string;
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

export default function KioskIdle() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => formatClock(new Date()));

  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      try {
        setIsLoading(true);
        setError("");

        const nextRoom = roomCode ? await getRoom(roomCode) : await createRoom();
        if (cancelled) {
          return;
        }

        setRoom(nextRoom);
        const canonicalPath = `/kiosk/${nextRoom.code}`;
        if (window.location.pathname !== canonicalPath) {
          navigate(canonicalPath, { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open this display.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRoom();
    return () => {
      cancelled = true;
    };
  }, [navigate, roomCode]);

  useEffect(() => {
    if (!room?.code) {
      return;
    }

    const socket = openRoomSocket(room.code, "display", {
      onRoom: setRoom,
      onError: setError,
    });

    return () => socket.close();
  }, [room?.code]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(formatClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const joinUrl = useMemo(() => {
    if (!room?.code) {
      return "";
    }
    return `${window.location.origin}/join/${room.code}`;
  }, [room?.code]);

  if (room?.status === "active" || room?.status === "paused" || room?.status === "calibrating" || room?.status === "rest") {
    return <KioskSession room={room} />;
  }

  if (room?.status === "complete" || room?.status === "ended") {
    return <KioskComplete room={room} />;
  }

  const userJoined = room && room.status !== "waiting" && room.status !== "expired";

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-3xl" />

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex items-center justify-between px-[clamp(1rem,3vw,3rem)] py-[clamp(1rem,2.5vh,2rem)] shrink-0">
          <Logo size="md" />
          <div className="flex items-center gap-[clamp(0.75rem,2vw,1.5rem)] text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="ring-dot" />
              <span>Kiosk online</span>
            </div>
            <div className="font-mono">{now}</div>
          </div>
        </header>

        <section className="flex-1 min-h-0 grid grid-cols-12 gap-[clamp(1rem,2.5vw,2.5rem)] px-[clamp(1rem,3vw,3rem)] pb-[clamp(1rem,2.5vh,2rem)] items-center">
          {isLoading ? (
            <div className="col-span-12 grid place-items-center">
              <div className="panel rounded-[2rem] p-8 flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Preparing display
              </div>
            </div>
          ) : error ? (
            <div className="col-span-12 grid place-items-center">
              <div className="panel rounded-[2rem] p-8 text-center max-w-lg">
                <div className="font-display text-3xl font-semibold">Display needs a fresh room</div>
                <p className="mt-3 text-muted-foreground">{error}</p>
                <button
                  className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 font-display font-semibold text-primary-foreground shadow-glow"
                  onClick={() => navigate("/kiosk", { replace: true })}
                >
                  <RotateCcw className="h-4 w-4" /> New QR
                </button>
              </div>
            </div>
          ) : room ? (
            <>
              <div className="col-span-5 flex h-full flex-col justify-start pt-[clamp(1.5rem,5vh,4rem)] space-y-[clamp(1rem,2.5vh,2rem)] min-h-0">
                <div className="inline-flex w-fit items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/60 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {userJoined ? "Controller connected" : "Ready when you are"}
                </div>

                <div className="space-y-4">
                  <h1 className="font-display text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[1.02]">
                    {userJoined ? (
                      <>
                        Phone joined <br />
                        <span className="text-gradient">the kiosk</span>.
                      </>
                    ) : (
                      <>
                        Scan to begin <br />
                        your <span className="text-gradient">stretch quest</span>.
                      </>
                    )}
                  </h1>

                  <p className="text-[clamp(1rem,1.5vw,1.125rem)] text-muted-foreground max-w-md leading-relaxed">
                    {userJoined
                      ? "Your phone is now the controller. Pick a routine there and this display will follow."
                      : "Point your phone camera at the code. Your phone becomes the controller and this screen becomes the game."}
                  </p>
                </div>

                {userJoined ? (
                  <div className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
                    Connected and ready for the next step.
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="px-5 py-4 rounded-2xl panel">
                      <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Join code</div>
                      <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{room.code}</div>
                    </div>
                    <div className="text-sm text-muted-foreground max-w-[240px] leading-relaxed break-words">
                      Or visit <span className="text-foreground font-mono">/join/{room.code}</span> to connect.
                    </div>
                  </div>
                )}
              </div>

              <div className="col-span-7 flex items-center justify-center min-h-0">
                <div className="relative anim-float">
                  <div className="absolute -inset-10 rounded-[3rem] bg-gradient-primary opacity-20 blur-3xl anim-pulse-glow" />
                  <div className="relative panel rounded-[2.5rem] p-[clamp(2.5rem,2.4vh,3rem)] anim-pulse-glow">
                    {[
                      "top-4 left-4 border-t-2 border-l-2",
                      "top-4 right-4 border-t-2 border-r-2",
                      "bottom-4 left-4 border-b-2 border-l-2",
                      "bottom-4 right-4 border-b-2 border-r-2",
                    ].map((corner) => (
                      <div key={corner} className={`absolute ${corner} h-8 w-8 border-primary/70 rounded-md`} />
                    ))}

                    {userJoined ? (
                      <div className="w-[min(39vw,31.5rem,calc(100vh-16.5rem))] max-w-[calc(100vw-8rem)] aspect-square rounded-[1.75rem] bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.2),transparent_60%)] border border-primary/25 flex flex-col items-center justify-center text-center px-8">
                        <CheckCircle2 className="h-24 w-24 text-primary" />
                        <div className="mt-6 font-display text-4xl font-semibold">User joined</div>
                        <div className="mt-3 text-base text-muted-foreground">Continue on the phone to pick a routine and begin.</div>
                      </div>
                    ) : (
                      <>
                        <div className="w-[min(39vw,31.5rem,calc(100vh-18.5rem))] max-w-[calc(100vw-8rem)] aspect-square bg-foreground rounded-[1.75rem] p-[clamp(1.25rem,2.4vw,2rem)] mx-auto">
                          <QRCodeSVG
                            value={joinUrl}
                            size={512}
                            className="h-full w-full"
                            level="H"
                            bgColor="transparent"
                            fgColor="hsl(240 50% 6%)"
                          />
                        </div>

                        <div className="mt-6 text-center">
                          <div className="font-display text-2xl font-medium">Scan to start</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <footer className="flex items-center justify-between px-[clamp(1rem,3vw,3rem)] py-[clamp(0.75rem,2vh,1.5rem)] text-xs text-muted-foreground border-t border-border/60 shrink-0">
          <div className="flex items-center gap-6">
            <span>Daily streaks, XP, calm progress</span>
            <span className="opacity-50">prototype UI</span>
          </div>
          {room && !userJoined ? (
            <a
              className="px-4 py-2 rounded-full bg-surface border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Simulate phone scan -&gt;
            </a>
          ) : (
            <span className="font-mono text-muted-foreground">{room ? joinUrl : ""}</span>
          )}
        </footer>
      </div>
    </main>
  );
}

function formatClock(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
