import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Star, Zap, Flame, RotateCcw } from "lucide-react";

export default function KioskComplete() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-3xl anim-pulse-glow" />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-10 py-6">
          <Logo size="sm" />
          <div className="text-xs text-muted-foreground">Studio · Bay 03 · 14:35</div>
        </header>

        <section className="flex-1 grid grid-cols-12 gap-10 px-12 pb-10 items-center">
          {/* Left: trophy */}
          <div className="col-span-5 flex justify-center">
            <div className="relative anim-float">
              <div className="absolute -inset-6 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
              <div className="relative panel rounded-[2.5rem] p-12 grid place-items-center">
                <div className="h-48 w-48 rounded-full bg-gradient-primary grid place-items-center glow-primary">
                  <Star className="h-24 w-24 text-primary-foreground fill-primary-foreground" />
                </div>
                <div className="mt-6 flex gap-2">
                  {[1,2,3,4,5].map(i=>(
                    <Star key={i} className={`h-7 w-7 ${i<=4 ? 'text-xp fill-xp':'text-muted'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: copy */}
          <div className="col-span-7 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs uppercase tracking-[0.25em]">
                Quest complete
              </div>
              <h1 className="font-display text-7xl font-semibold mt-4 leading-[1.02]">
                Nicely done. <br />
                <span className="text-gradient">You showed up.</span>
              </h1>
              <p className="text-lg text-muted-foreground mt-4 max-w-xl">
                Quick Reset · 4 stretches · 3 minutes of calm, focused movement.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard icon={<Zap className="h-5 w-5 text-xp" />} label="XP earned" value="+240" />
              <StatCard icon={<Star className="h-5 w-5 text-xp" />} label="Stars" value="4 / 5" />
              <StatCard icon={<Flame className="h-5 w-5 text-accent" />} label="Streak" value="3 days" />
            </div>

            <div className="panel rounded-3xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-surface-2 grid place-items-center">
                  <RotateCcw className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-display text-lg">Continue on your phone</div>
                  <div className="text-sm text-muted-foreground">Scan again to pick another routine or save your progress.</div>
                </div>
              </div>
              <Link to="/kiosk" className="px-5 py-3 rounded-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
                New session
              </Link>
            </div>
          </div>
        </section>

        <footer className="px-12 py-6 text-center text-xs text-muted-foreground border-t border-border/60">
          Consistency &gt; intensity. See you tomorrow for day 4.
        </footer>
      </div>
    </main>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="panel rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-[0.2em]">
        {icon} {label}
      </div>
      <div className="font-display text-3xl font-semibold mt-2">{value}</div>
    </div>
  );
}
