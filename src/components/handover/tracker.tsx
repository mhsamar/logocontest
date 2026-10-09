import { cx } from "@/lib/cx";
import { trackerStep, type HandoverStatus } from "@/lib/handover/options";
import type { Translate } from "@/lib/i18n/translate";

/** Four-step tracker (UI-JOURNEY C-17): Winner picked → Files uploaded → Client's review → Done. */
export function HandoverTracker({ status, t }: { status: HandoverStatus; t: Translate }) {
  const step = trackerStep(status);
  const labels = [t("handover.steps.picked"), t("handover.steps.files"), t("handover.steps.review"), t("handover.steps.done")];
  return (
    <ol className="grid grid-cols-4 gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < step || step === 4;
        const current = n === step && step !== 4;
        return (
          <li key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span className="relative flex w-full items-center">
              <span className={cx("h-1 flex-1 rounded-full", i === 0 ? "bg-transparent" : n <= step ? "bg-primary" : "bg-line")} />
              <span
                className={cx(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  done ? "bg-primary text-white" : current ? "bg-white text-primary ring-2 ring-primary" : "bg-canvas text-muted ring-1 ring-line",
                )}
              >
                {done ? (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  n
                )}
                {current && <span className="absolute inline-flex size-8 animate-ping rounded-full bg-primary/20" aria-hidden />}
              </span>
              <span className={cx("h-1 flex-1 rounded-full", i === 3 ? "bg-transparent" : n < step ? "bg-primary" : "bg-line")} />
            </span>
            <span className={cx("text-xs leading-tight", current ? "font-semibold text-ink" : "text-muted")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
