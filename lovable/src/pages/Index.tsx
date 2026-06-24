import { Link } from "react-router-dom";

const screens = [
  { to: "/kiosk", label: "Kiosk · Idle QR", tag: "Display" },
  { to: "/kiosk/session", label: "Kiosk · Active Session", tag: "Display" },
  { to: "/kiosk/complete", label: "Kiosk · Quest Complete", tag: "Display" },
  { to: "/phone", label: "Phone · Join", tag: "Mobile" },
  { to: "/phone/controller", label: "Phone · Controller", tag: "Mobile" },
];

export default function Index() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary glow-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">YUEDMAI Next</h1>
            <p className="text-sm text-muted-foreground">UI prototype · review the kiosk + phone flow</p>
          </div>
        </div>

        <div className="panel rounded-3xl p-2">
          <ul className="divide-y divide-border">
            {screens.map((s) => (
              <li key={s.to}>
                <Link
                  to={s.to}
                  className="flex items-center justify-between gap-4 px-5 py-5 rounded-2xl hover:bg-surface-2 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono px-2 py-1 rounded-md bg-surface text-muted-foreground border border-border">
                      {s.tag}
                    </span>
                    <span className="font-display text-lg">{s.label}</span>
                  </div>
                  <span className="text-primary opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Tip: open <span className="font-mono text-foreground">/kiosk</span> on a landscape display and <span className="font-mono text-foreground">/phone</span> on a phone.
        </p>
      </div>
    </main>
  );
}
