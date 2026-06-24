import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Star, Zap, Camera } from "lucide-react";

export default function KioskSession() {
  const current = 2;
  const total = 4;
  const stretchName = "Shoulder Opener";

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-40 right-0 h-[36rem] w-[36rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute -bottom-40 left-0 h-[36rem] w-[36rem] rounded-full bg-primary/15 blur-3xl" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar — game HUD */}
        <header className="flex items-center justify-between px-10 py-6">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <HUDPill label="Stretch" value={`${current} / ${total}`} />
            <HUDPill label="XP" value="+240" icon={<Zap className="h-4 w-4 text-xp" />} />
            <HUDPill label="Stars" value="★ ★ ★ ☆" />
          </div>
          <Link to="/kiosk/complete" className="text-xs text-muted-foreground hover:text-foreground">End →</Link>
        </header>

        {/* Main */}
        <section className="flex-1 grid grid-cols-12 gap-8 px-10 pb-10">
          {/* Camera preview */}
          <div className="col-span-7 panel rounded-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,hsl(var(--primary)/0.18),transparent_60%)]" />
            {/* mock pose silhouette */}
            <div className="absolute inset-0 flex items-end justify-center pb-10">
              <svg viewBox="0 0 200 280" className="h-[70%] text-primary/40">
                <circle cx="100" cy="40" r="22" fill="currentColor" />
                <rect x="86" y="68" width="28" height="90" rx="14" fill="currentColor" />
                <rect x="40" y="80" width="60" height="14" rx="7" fill="currentColor" transform="rotate(-20 70 87)" />
                <rect x="100" y="80" width="60" height="14" rx="7" fill="currentColor" transform="rotate(20 130 87)" />
                <rect x="88" y="155" width="10" height="100" rx="5" fill="currentColor" />
                <rect x="102" y="155" width="10" height="100" rx="5" fill="currentColor" />
              </svg>
            </div>

            {/* scan line */}
            <div className="absolute inset-x-8 top-0 bottom-0 overflow-hidden pointer-events-none">
              <div className="anim-scan h-24 w-full bg-gradient-to-b from-transparent via-primary/30 to-transparent blur-md" />
            </div>

            {/* corner brackets */}
            {["top-4 left-4 border-t-2 border-l-2","top-4 right-4 border-t-2 border-r-2","bottom-4 left-4 border-b-2 border-l-2","bottom-4 right-4 border-b-2 border-r-2"].map(c=>(
              <div key={c} className={`absolute ${c} h-10 w-10 border-primary/70 rounded-lg`} />
            ))}

            {/* badges */}
            <div className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/70 backdrop-blur text-xs border border-border">
              <Camera className="h-3.5 w-3.5 text-primary" /> Pose tracking · live
            </div>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl bg-background/70 backdrop-blur border border-primary/40 text-primary font-display text-lg">
              Hold steady — great form
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-5 flex flex-col gap-6">
            <div className="panel rounded-3xl p-8">
              <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Now stretching</div>
              <h2 className="font-display text-5xl font-semibold mt-2 leading-tight">{stretchName}</h2>
              <p className="text-muted-foreground mt-3">Reach gently across, breathe out as you extend.</p>

              {/* timer */}
              <div className="mt-8">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Hold</div>
                    <div className="font-mono text-6xl font-bold text-gradient leading-none">00:18</div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    of 00:30
                  </div>
                </div>
                <div className="h-3 rounded-full bg-surface overflow-hidden border border-border">
                  <div className="h-full bg-gradient-primary" style={{ width: "62%" }} />
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
                  <div className="font-display text-xl">Quick Reset</div>
                </div>
              </div>
              <div className="flex gap-1">
                {[1,2,3,4].map(i=>(
                  <div key={i} className={`h-3 w-10 rounded-full ${i<=current?'bg-gradient-primary':'bg-surface border border-border'}`} />
                ))}
              </div>
            </div>

            <div className="panel rounded-3xl p-5 flex items-center gap-4">
              <Star className="h-6 w-6 text-xp fill-xp" />
              <p className="text-sm text-muted-foreground"><span className="text-foreground font-medium">Nice rhythm.</span> Keep breathing — you're on day 3 of your streak.</p>
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
