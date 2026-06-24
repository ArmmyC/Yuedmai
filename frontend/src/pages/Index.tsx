import { Link } from "react-router-dom";

const screens = [
  { to: "/display", label: "Open kiosk display", tag: "Display" },
];

export default function Index() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary glow-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">YUEDMAI Next</h1>
            <p className="text-sm text-muted-foreground">Open the kiosk screen, then scan the QR with your phone.</p>
          </div>
        </div>

        <div className="panel rounded-3xl p-2">
          <ul className="divide-y divide-border">
            {screens.map((screen) => (
              <li key={screen.to}>
                <Link
                  to={screen.to}
                  className="flex items-center justify-between gap-4 px-5 py-5 rounded-2xl hover:bg-surface-2 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono px-2 py-1 rounded-md bg-surface text-muted-foreground border border-border">
                      {screen.tag}
                    </span>
                    <span className="font-display text-lg">{screen.label}</span>
                  </div>
                  <span className="text-primary opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">-&gt;</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
