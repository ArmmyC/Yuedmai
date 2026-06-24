import { Camera, Star, Zap } from "lucide-react";

import { Logo } from "@/components/Logo";

type Room = {
  code: string;
  status: string;
  selected_routine?: {
    name: string;
    duration_seconds: number;
    stretches: string[];
  } | null;
  session?: {
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

export default function KioskSession({ room }: { room?: Room }) {
  const session = room?.session;
  const routine = room?.selected_routine;
  const current = session ? session.current_index + 1 : 1;
  const total = session?.total_stretches ?? routine?.stretches.length ?? 4;
  const stretchName = session?.current_name ?? routine?.stretches[0] ?? "Get ready";
  const elapsed = session?.elapsed_seconds ?? 0;
  const totalSeconds = routine ? Math.max(30, Math.round(routine.duration_seconds / total)) : 30;
  const segmentElapsed = elapsed % totalSeconds;
  const progress = Math.min(100, Math.round((segmentElapsed / totalSeconds) * 100));
  const roomStatus = room?.status === "paused" ? "Paused" : room?.status === "calibrating" ? "Calibrating" : "Pose tracking live";
  const feedback = session?.feedback_message ?? "Stand where the camera can see you.";

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,hsl(var(--accent)/0.16),transparent_45%),radial-gradient(circle_at_15%_100%,hsl(var(--primary)/0.16),transparent_46%)]" />

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex items-center justify-between px-[clamp(1.25rem,3vw,2.5rem)] py-[clamp(1rem,2.5vh,1.5rem)] shrink-0">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <HUDPill label="Stretch" value={`${current} / ${total}`} />
            <HUDPill label="XP" value={`+${session?.xp_earned ?? 0}`} icon={<Zap className="h-4 w-4 text-xp" />} />
            <HUDPill label="Stars" value={`${session?.total_stars ?? 0}`} icon={<Star className="h-4 w-4 text-xp fill-xp" />} />
          </div>
          <div className="font-mono text-xs text-muted-foreground">{room?.code}</div>
        </header>

        <section className="flex-1 min-h-0 grid grid-cols-12 gap-[clamp(1rem,2.5vw,2rem)] px-[clamp(1.25rem,3vw,2.5rem)] pb-[clamp(1.25rem,3vh,2.5rem)]">
          <div className="col-span-7 panel rounded-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,hsl(var(--primary)/0.18),transparent_60%)]" />
            <div className="absolute inset-0 flex items-end justify-center pb-10">
              <svg viewBox="0 0 200 280" className="h-[70%] text-primary/40" aria-hidden="true">
                <circle cx="100" cy="40" r="22" fill="currentColor" />
                <rect x="86" y="68" width="28" height="90" rx="14" fill="currentColor" />
                <rect x="40" y="80" width="60" height="14" rx="7" fill="currentColor" transform="rotate(-20 70 87)" />
                <rect x="100" y="80" width="60" height="14" rx="7" fill="currentColor" transform="rotate(20 130 87)" />
                <rect x="88" y="155" width="10" height="100" rx="5" fill="currentColor" />
                <rect x="102" y="155" width="10" height="100" rx="5" fill="currentColor" />
              </svg>
            </div>

            <div className="absolute inset-x-8 top-0 bottom-0 overflow-hidden pointer-events-none">
              <div className="anim-scan h-24 w-full bg-gradient-to-b from-transparent via-primary/30 to-transparent blur-md" />
            </div>

            {["top-4 left-4 border-t-2 border-l-2", "top-4 right-4 border-t-2 border-r-2", "bottom-4 left-4 border-b-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2"].map((corner) => (
              <div key={corner} className={`absolute ${corner} h-10 w-10 border-primary/70 rounded-lg`} />
            ))}

            <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/70 backdrop-blur text-xs border border-border">
              <Camera className="h-3.5 w-3.5 text-primary" /> {roomStatus}
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl bg-background/70 backdrop-blur border border-primary/40 text-primary font-display text-lg">
              {feedback}
            </div>
          </div>

          <div className="col-span-5 flex flex-col gap-6">
            <div className="panel rounded-3xl p-[clamp(1.5rem,4vh,2rem)]">
              <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Now stretching</div>
              <h2 className="font-display text-[clamp(2.5rem,6vh,5rem)] font-semibold mt-2 leading-tight">{stretchName}</h2>
              <p className="text-muted-foreground mt-3">Move gently and keep breathing.</p>

              <div className="mt-8">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Hold</div>
                    <div className="font-mono text-[clamp(3rem,8vh,5rem)] font-bold text-gradient leading-none">
                      {formatSeconds(segmentElapsed)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    of {formatSeconds(totalSeconds)}
                  </div>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden border border-border">
                  <div className="h-full bg-gradient-primary" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="panel rounded-3xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-xp/20 border border-xp/40 grid place-items-center">
                  <Zap className="h-6 w-6 text-xp" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Quest progress</div>
                  <div className="font-display text-xl">{routine?.name ?? "Quick Reset"}</div>
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: total }, (_, index) => (
                  <div key={index} className={`h-3 w-10 rounded-full ${index < current ? "bg-gradient-primary" : "bg-surface border border-border"}`} />
                ))}
              </div>
            </div>

            <div className="panel rounded-3xl p-5 flex items-center gap-4">
              <Star className="h-6 w-6 text-xp fill-xp" />
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Nice rhythm.</span> Consistency beats intensity.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function HUDPill({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="panel rounded-full px-5 py-2 flex items-center gap-3">
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
