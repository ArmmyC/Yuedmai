import { Flame, RotateCcw, Star, Zap } from "lucide-react";

import { Logo } from "@/components/Logo";

type Room = {
  code: string;
  selected_routine?: {
    name: string;
    stretches: string[];
    duration_seconds: number;
  } | null;
  session?: {
    xp_earned: number;
    total_stars: number;
    total_stretches: number;
  } | null;
};

export default function KioskComplete({ room }: { room?: Room }) {
  const routine = room?.selected_routine;
  const session = room?.session;
  const stars = session?.total_stars ?? 0;
  const totalStars = Math.max(5, (session?.total_stretches ?? routine?.stretches.length ?? 5) * 3);

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.20),transparent_48%)]" />

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex items-center justify-between px-10 py-6 shrink-0">
          <Logo size="sm" />
          <div className="font-mono text-xs text-muted-foreground">{room?.code}</div>
        </header>

        <section className="flex-1 min-h-0 grid grid-cols-12 gap-10 px-12 pb-10 items-center">
          <div className="col-span-5 flex justify-center">
            <div className="relative anim-float">
              <div className="absolute -inset-6 rounded-full bg-gradient-primary opacity-30 blur-3xl" />
              <div className="relative panel rounded-[2.5rem] p-12 grid place-items-center">
                <div className="h-48 w-48 rounded-full bg-gradient-primary grid place-items-center glow-primary">
                  <Star className="h-24 w-24 text-primary-foreground fill-primary-foreground" />
                </div>
                <div className="mt-6 flex gap-2">
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} className={`h-7 w-7 ${index < Math.min(5, Math.ceil(stars / 3)) ? "text-xp fill-xp" : "text-muted"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-7 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs uppercase tracking-[0.25em]">
                Quest complete
              </div>
              <h1 className="font-display text-[clamp(4rem,9vh,7rem)] font-semibold mt-4 leading-[1.02]">
                Nicely done. <br />
                <span className="text-gradient">You showed up.</span>
              </h1>
              <p className="text-lg text-muted-foreground mt-4 max-w-xl">
                {routine?.name ?? "Quick Reset"} complete.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <StatCard icon={<Zap className="h-5 w-5 text-xp" />} label="XP earned" value={`+${session?.xp_earned ?? 0}`} />
              <StatCard icon={<Star className="h-5 w-5 text-xp" />} label="Stars" value={`${stars} / ${totalStars}`} />
              <StatCard icon={<Flame className="h-5 w-5 text-accent" />} label="Room" value={room?.code ?? "Ready"} />
            </div>

            <div className="panel rounded-3xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-surface-2 grid place-items-center">
                  <RotateCcw className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-display text-lg">Continue on your phone</div>
                  <div className="text-sm text-muted-foreground">Tap Again on the controller to choose another quest.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
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
