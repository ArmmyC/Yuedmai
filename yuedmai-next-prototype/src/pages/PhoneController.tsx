import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Play, Pause, SkipForward, Square, Camera, Clock } from "lucide-react";

const stretches = [
  "Neck reset",
  "Shoulder opener",
  "Standing side bend",
  "Hamstring reach",
];

export default function PhoneController() {
  return (
    <main className="min-h-screen flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col px-5 py-6 gap-5">
        {/* Status bar */}
        <header className="flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 text-success text-xs">
            <span className="ring-dot" /> Connected
          </div>
        </header>

        {/* Session card */}
        <div className="panel rounded-3xl p-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Room</div>
            <div className="font-mono text-2xl font-bold tracking-[0.25em] text-primary">K8P4</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Mode</div>
            <div className="text-sm font-medium">Guest · Free play</div>
          </div>
        </div>

        {/* Routine card */}
        <div className="rounded-3xl p-6 bg-gradient-panel border border-border relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/30">Selected routine</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> 3 min</span>
            </div>
            <h2 className="font-display text-2xl font-semibold">Quick Reset</h2>
            <p className="text-sm text-muted-foreground mt-1">A calm 4-step sequence to unwind tight spots.</p>

            <ul className="mt-4 space-y-2">
              {stretches.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className="h-6 w-6 rounded-full bg-surface border border-border grid place-items-center text-[11px] font-mono text-muted-foreground">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Calibration */}
        <button className="w-full h-14 rounded-2xl border border-primary/40 bg-primary/10 text-primary font-medium flex items-center justify-center gap-2 hover:bg-primary/15 transition-colors">
          <Camera className="h-5 w-5" /> Start Calibration
        </button>

        {/* Primary action */}
        <Link
          to="/kiosk/session"
          className="w-full h-16 rounded-2xl bg-gradient-primary text-primary-foreground font-display text-lg font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[0.99] transition-transform"
        >
          <Play className="h-5 w-5 fill-current" /> Start Quest
        </Link>

        {/* Secondary controls */}
        <div className="grid grid-cols-3 gap-3">
          <ControlButton icon={<Pause className="h-5 w-5" />} label="Pause" />
          <ControlButton icon={<Play className="h-5 w-5" />} label="Resume" />
          <ControlButton icon={<SkipForward className="h-5 w-5" />} label="Next" />
        </div>

        <Link
          to="/kiosk/complete"
          className="w-full h-12 rounded-2xl border border-border bg-surface/60 text-muted-foreground text-sm font-medium flex items-center justify-center gap-2 hover:text-foreground transition-colors"
        >
          <Square className="h-4 w-4" /> End session
        </Link>

        <div className="text-center text-[11px] text-muted-foreground pt-2">
          Tip: keep your phone in hand — your stretches happen in front of the kiosk.
        </div>
      </div>
    </main>
  );
}

function ControlButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="h-16 rounded-2xl panel flex flex-col items-center justify-center gap-1 hover:border-primary/40 transition-colors">
      <span className="text-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}
