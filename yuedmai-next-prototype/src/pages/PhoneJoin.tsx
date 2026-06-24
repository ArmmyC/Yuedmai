import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { ArrowRight, UserCircle2, ShieldCheck } from "lucide-react";

const JOIN_CODE = "K8P4";

export default function PhoneJoin() {
  return (
    <main className="min-h-screen flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col px-6 py-8 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />

        <header className="relative flex items-center justify-between">
          <Logo size="sm" />
          <Link to="/" className="text-xs text-muted-foreground">Exit</Link>
        </header>

        <section className="relative flex-1 flex flex-col justify-center py-10 space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/30 text-success text-xs">
              <span className="ring-dot" />
              Kiosk found
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight">
              You're connecting to <br />
              <span className="text-gradient">Studio · Bay 03</span>
            </h1>
            <p className="text-muted-foreground">Confirm the code on the big screen matches below.</p>
          </div>

          <div className="panel rounded-3xl p-6 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Room code</div>
              <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary mt-1">{JOIN_CODE}</div>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center text-primary-foreground">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>

          <div className="space-y-3">
            <Link
              to="/phone/controller"
              className="w-full h-16 rounded-2xl bg-gradient-primary text-primary-foreground font-display text-lg font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[0.99] transition-transform"
            >
              Continue as guest <ArrowRight className="h-5 w-5" />
            </Link>
            <button
              className="w-full h-14 rounded-2xl border border-border bg-surface/60 text-foreground font-medium flex items-center justify-center gap-2 hover:border-primary/50 transition-colors"
              onClick={() => alert("Login placeholder — coming soon")}
            >
              <UserCircle2 className="h-5 w-5 text-muted-foreground" /> Log in to save progress
            </button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 text-sm text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Guest mode</span> plays right now. <span className="text-foreground font-medium">Log in</span> later to save XP, streaks, and your favorite routines.
          </div>
        </section>

        <footer className="text-center text-[11px] text-muted-foreground">
          By continuing you agree to our calm, no-shame movement guidelines.
        </footer>
      </div>
    </main>
  );
}
