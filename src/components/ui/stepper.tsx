/** Thin progress bar with "Step 3 of 11" text (UI-JOURNEY §1.3). */
export function Stepper({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <div
        className="h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={label}
      >
        <div className="bar-fill h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}
