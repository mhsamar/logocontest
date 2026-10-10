import { cx } from "@/lib/cx";

/** Simple charts of the admin design (design/admin): split bars, bar rows and a bar chart by day. */

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** Two parts of a whole, e.g. members and guests: labels with "6 · 50%" over a two-colour bar. */
export function SplitBar({ left, right, num, showPct = true }: { left: { label: string; n: number }; right: { label: string; n: number }; num: (n: number) => string; showPct?: boolean }) {
  const total = left.n + right.n;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2.5 text-[15px]">
        <span className="font-bold">
          {left.label} <span className="font-medium text-muted">{showPct ? `${num(left.n)} · ${num(pct(left.n, total))}%` : num(left.n)}</span>
        </span>
        <span className="text-right font-bold">
          <span className="font-medium text-muted">{showPct ? `${num(pct(right.n, total))}% · ${num(right.n)}` : num(right.n)}</span> {right.label}
        </span>
      </div>
      <div aria-hidden className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-[#c9ccd3]">
        {left.n > 0 && <span className="bg-primary" style={{ flex: left.n }} />}
        {right.n > 0 && <span className="bg-[#c9ccd3]" style={{ flex: right.n }} />}
      </div>
    </div>
  );
}

/** One row: label, bar, count and share. `of` is the whole the share is taken from; the bar is scaled to `max`. */
export function BarRow({ label, n, of, max, num, labelWidth = "w-[104px]", title }: { label: React.ReactNode; n: number; of: number; max: number; num: (n: number) => string; labelWidth?: string; title?: string }) {
  return (
    <div className="flex items-center gap-3 text-[15px]">
      <span className={cx("shrink-0 truncate font-semibold", labelWidth)} title={title}>
        {label}
      </span>
      <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#f0f1f4]">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(n ? 2 : 0, (n / max) * 100) : 0}%` }} />
      </span>
      <span className="w-16 shrink-0 text-right tabular-nums">
        <strong>{num(n)}</strong> <span className="text-muted">{num(pct(n, of))}%</span>
      </span>
    </div>
  );
}

/** Label and numbers on one line, the bar under it (for longer labels). */
export function BarBlock({ label, n, of, max, num }: { label: React.ReactNode; n: number; of: number; max: number; num: (n: number) => string }) {
  return (
    <div className="flex flex-col gap-[5px] text-[15px]">
      <div className="flex justify-between gap-2.5">
        <span className="min-w-0 truncate font-semibold">{label}</span>
        <span className="shrink-0 tabular-nums">
          <strong>{num(n)}</strong> <span className="text-muted">{num(pct(n, of))}%</span>
        </span>
      </div>
      <span className="h-3 overflow-hidden rounded-full bg-[#f0f1f4]">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(n ? 2 : 0, (n / max) * 100) : 0}%` }} />
      </span>
    </div>
  );
}

/**
 * Bars by day with a light grid (max, half, 0). `strong` marks today. With many days the chart scrolls inside its
 * card instead of squeezing the bars.
 */
export function DayBarChart({ days, label, num, color = "bg-primary" }: { days: { key: string; label: string; n: number; strong?: boolean }[]; label: string; num: (n: number) => string; color?: string }) {
  const top = Math.max(1, ...days.map((d) => d.n));
  const steps = top <= 1 ? [top, 0] : [top, Math.round(top / 2), 0];
  return (
    <div className="overflow-x-auto">
      <div role="img" aria-label={label} className="relative h-60 pl-[30px]" style={{ minWidth: Math.max(280, days.length * 58) }}>
        <div className="absolute bottom-[30px] left-[30px] right-0 top-6 flex flex-col justify-between">
          {steps.map((v, i) => (
            <div key={i} className={cx("relative border-t", i === steps.length - 1 ? "border-solid border-[#c9ccd3]" : "border-dashed border-[#e3e4e8]")}>
              <span className="absolute -left-[30px] -top-[9px] text-[13px] tabular-nums text-muted">{num(v)}</span>
            </div>
          ))}
        </div>
        <div className="absolute inset-y-0 left-[30px] right-0 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => (
            <div key={d.key} className="relative flex flex-col items-center justify-end pb-[30px]">
              <span className={cx("pb-1 text-[13.5px] font-bold tabular-nums", d.n ? "text-ink" : "text-muted")}>{num(d.n)}</span>
              {d.n > 0 ? (
                <span className={cx("w-[56%] max-w-16 rounded-t-[4px]", color)} style={{ height: `${(d.n / top) * 186}px` }} />
              ) : (
                <span className="h-0.5 w-[56%] max-w-16 bg-[#c9ccd3]" />
              )}
              <span className={cx("absolute bottom-1 whitespace-nowrap text-[13.5px]", d.strong ? "font-bold text-ink" : "text-muted")}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
