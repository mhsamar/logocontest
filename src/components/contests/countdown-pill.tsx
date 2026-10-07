import { cx } from "@/lib/cx";

/** "3 days left"; turns amber under 24 hours (UI-JOURNEY §1.3). */
export function CountdownPill({ endsAt, now, labels }: { endsAt: Date; now: Date; labels: { days: string; hours: string; ended: string } }) {
  const ms = endsAt.getTime() - now.getTime();
  const soon = ms > 0 && ms < 86_400_000;
  const text = ms <= 0 ? labels.ended : soon ? labels.hours : labels.days;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        soon ? "bg-warning/10 text-warning" : "bg-canvas text-muted ring-1 ring-inset ring-line",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
      {text}
    </span>
  );
}

export function timeLeft(endsAt: Date, now: Date) {
  const ms = Math.max(0, endsAt.getTime() - now.getTime());
  return { days: Math.ceil(ms / 86_400_000), hours: Math.max(1, Math.ceil(ms / 3_600_000)) };
}
