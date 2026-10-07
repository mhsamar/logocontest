"use client";

import { useI18n } from "@/lib/i18n/client";

/** Five tappable suggestions under a text box. Picking one fills the box; the client can edit it. */
export function Suggestions({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg bg-surface p-3 ring-1 ring-line">
      <p className="mb-2 flex items-center gap-2 px-1 text-sm font-medium text-ink">
        <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" strokeLinecap="round" />
        </svg>
        {t("wizard.suggest.title")}
      </p>
      <ul className="space-y-1.5">
        {items.map((text) => (
          <li key={text}>
            <button
              type="button"
              onClick={() => onPick(text)}
              className="flex min-h-11 w-full items-start gap-2 rounded-md bg-canvas px-3 py-2.5 text-left text-sm leading-snug text-ink ring-1 ring-transparent transition-colors hover:bg-surface hover:ring-primary"
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
