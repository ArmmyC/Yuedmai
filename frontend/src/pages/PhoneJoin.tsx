import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Loader2, ShieldCheck, UserCircle2 } from "lucide-react";

import { Logo } from "@/components/Logo";
import { getRoom, joinRoom } from "@/api.js";
import { normalizeRoomCode, rememberControllerAccess } from "@/router.js";

export default function PhoneJoin() {
  const { roomCode = "" } = useParams();
  const navigate = useNavigate();
  const code = normalizeRoomCode(roomCode);
  const [status, setStatus] = useState("Checking room");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkRoom() {
      try {
        setError("");
        await getRoom(code);
        if (!cancelled) {
          setStatus("Kiosk found");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "This room is not available.");
          setStatus("Room unavailable");
        }
      }
    }

    checkRoom();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function continueAsGuest() {
    try {
      setIsJoining(true);
      setError("");
      await joinRoom(code, "guest");
      rememberControllerAccess(code);
      navigate(`/controller/${code}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this room.");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className="min-h-screen flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col px-6 py-8 relative">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.25),transparent_62%)]" />

        <header className="relative flex items-center justify-between">
          <Logo size="sm" />
          <Link to={`/kiosk/${code}`} className="text-xs text-muted-foreground">Exit</Link>
        </header>

        <section className="relative flex-1 flex flex-col justify-center py-10 space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/30 text-success text-xs">
              <span className="ring-dot" />
              {status}
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight">Join this kiosk</h1>
            <p className="text-muted-foreground">Confirm the code on the big screen matches below.</p>
          </div>

          <div className="panel rounded-3xl p-6 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Room code</div>
              <div className="font-mono text-4xl font-bold tracking-[0.3em] text-primary mt-1">{code}</div>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center text-primary-foreground">
              <ShieldCheck className="h-7 w-7" />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}

          <div className="space-y-3">
            <button
              className="w-full h-16 rounded-2xl bg-gradient-primary text-primary-foreground font-display text-lg font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[0.99] transition-transform disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(error) || isJoining}
              onClick={continueAsGuest}
            >
              {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              Continue as guest
            </button>
            <button
              className="w-full h-14 rounded-2xl border border-border bg-surface/60 text-foreground font-medium flex items-center justify-center gap-2 hover:border-primary/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              disabled={Boolean(error) || isJoining}
              onClick={continueAsGuest}
            >
              <UserCircle2 className="h-5 w-5 text-muted-foreground" /> Continue without login
            </button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 text-sm text-muted-foreground leading-relaxed">
            <span className="text-foreground font-medium">Guest mode</span> plays right now. You can add saved progress later.
          </div>
        </section>

        <footer className="text-center text-[11px] text-muted-foreground">
          By continuing you agree to our calm, no-shame movement guidelines.
        </footer>
      </div>
    </main>
  );
}
