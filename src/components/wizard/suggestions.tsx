"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

const BULB = (
  <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" strokeLinecap="round" />
  </svg>
);

/**
 * Five tappable suggestions under a text box (owner, 2026-10-08). Tapping one fills the box and
 * hides the list; when the box is empty again, a "Need ideas?" button brings the list back.
 */
export function Suggestions({ items, value, onPick }: { items: string[]; value: string; onPick: (text: string) => void }) {
  const { t } = useI18n();
  // Open at first only when the box is still empty.
  const [open, setOpen] = useState(() => value.trim() === "");

  if (!open) {
    if (value.trim() !== "") return null;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full animate-fade-in items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.07]"
      >
        {BULB}
        {t("wizard.suggest.show", { n: items.length })}
      </button>
    );
  }

  return (
    <div className="animate-rise rounded-xl bg-surface p-3 ring-1 ring-line">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          {BULB}
          {t("wizard.suggest.title")}
        </p>
        <button type="button" onClick={() => setOpen(false)} className="min-h-9 shrink-0 px-2 text-xs font-semibold text-muted hover:text-ink">
          {t("wizard.suggest.hide")}
        </button>
      </div>
      <ul className="space-y-1.5">
        {items.map((text, i) => (
          <li key={text} className="animate-item-in" style={{ animationDelay: `${i * 50}ms` }}>
            <button
              type="button"
              onClick={() => {
                onPick(text);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-start gap-2 rounded-lg bg-canvas px-3 py-2.5 text-left text-sm leading-relaxed text-ink ring-1 ring-transparent transition-[background-color,box-shadow] hover:bg-surface hover:ring-primary"
            >
              <span className="mt-0.5 text-primary" aria-hidden>
                +
              </span>
              <span>{text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
