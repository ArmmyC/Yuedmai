import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Wifi, Sparkles } from "lucide-react";

const JOIN_CODE = "K8P4";
const JOIN_URL = `https://yuedmai.app/join/${JOIN_CODE}`;

export default function KioskIdle() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* ambient grid + orbs */}
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[40rem] w-[40rem] rounded-full bg-primary/20 blur-3xl" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-12 py-8">
          <Logo size="md" />
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="ring-dot" />
              <span>Kiosk online</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <span>Studio · Bay 03</span>
            </div>
            <div className="font-mono">14:32</div>
          </div>
        </header>

        {/* Main split */}
        <section className="flex-1 grid grid-cols-12 gap-10 px-12 pb-12 items-center">
          {/* Left: copy */}
          <div className="col-span-5 space-y-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/60 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Ready when you are
            </div>

            <h1 className="font-display text-6xl xl:text-7xl font-semibold leading-[1.02]">
              Scan to begin <br />
              your <span className="text-gradient">stretch quest</span>.
            </h1>

            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Point your phone camera at the code. Your phone becomes the controller — this screen becomes the game.
            </p>

            <div className="flex items-center gap-4">
              <div className="px-5 py-4 rounded-2xl panel">
                <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Join code</div>
                <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{JOIN_CODE}</div>
              </div>
              <div className="text-sm text-muted-foreground max-w-[180px] leading-relaxed">
                Or visit <span className="text-foreground font-mono">yuedmai.app/join</span> and enter the code.
              </div>
            </div>
          </div>

          {/* Right: QR */}
          <div className="col-span-7 flex items-center justify-center">
            <div className="relative anim-float">
              {/* Outer glow ring */}
              <div className="absolute -inset-10 rounded-[3rem] bg-gradient-primary opacity-20 blur-3xl anim-pulse-glow" />

              {/* QR Panel */}
              <div className="relative panel rounded-[2.5rem] p-10 anim-pulse-glow">
                {/* corner brackets */}
                {[
                  "top-4 left-4 border-t-2 border-l-2",
                  "top-4 right-4 border-t-2 border-r-2",
                  "bottom-4 left-4 border-b-2 border-l-2",
                  "bottom-4 right-4 border-b-2 border-r-2",
                ].map((c) => (
                  <div key={c} className={`absolute ${c} h-8 w-8 border-primary/70 rounded-md`} />
                ))}

                <div className="bg-foreground rounded-[1.75rem] p-6">
                  <QRCodeSVG
                    value={JOIN_URL}
                    size={420}
                    level="H"
                    bgColor="transparent"
                    fgColor="hsl(240 50% 6%)"
                    marginSize={0}
                  />
                </div>

                <div className="mt-6 text-center">
                  <div className="font-display text-2xl font-medium">Scan to start</div>
                  <div className="text-sm text-muted-foreground mt-1">No app needed · works in your camera</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer hint */}
        <footer className="flex items-center justify-between px-12 py-6 text-xs text-muted-foreground border-t border-border/60">
          <div className="flex items-center gap-6">
            <span>Daily streaks · XP · Calm progress</span>
            <span className="opacity-50">v0.1 prototype</span>
          </div>
          <Link
            to="/phone"
            className="px-4 py-2 rounded-full bg-surface border border-border hover:border-primary/60 hover:text-foreground transition-colors"
          >
            Simulate phone scan →
          </Link>
        </footer>
      </div>
    </main>
  );
}
