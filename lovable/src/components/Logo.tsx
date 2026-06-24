export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-3">
      <div className={`${px} rounded-xl bg-gradient-primary relative overflow-hidden glow-primary`}>
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-2 w-2 rounded-full bg-background/80" />
        </div>
      </div>
      <div className="leading-none">
        <div className={`font-display font-semibold tracking-tight ${text}`}>YUEDMAI</div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mt-1">Next</div>
      </div>
    </div>
  );
}
