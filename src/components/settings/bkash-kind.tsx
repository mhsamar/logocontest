"use client";

import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Personal or agent bKash number (owner, 2026-10-15): the team sends money differently to each, so designers tick one
 * at sign-up and in Profile › Payout method. Admin › Withdrawals and Admin › Users show it.
 */
export function BkashKindPicker({ value, onChange, error }: { value: string; onChange: (kind: "personal" | "agent") => void; error?: string }) {
  const { t } = useI18n();
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1.5 text-[15px] font-semibold text-ink">{t("wallet.form.bkashKind")}</legend>
      <div className="flex gap-2" role="radiogroup">
        {(["personal", "agent"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onChange(k)}
            className={cx(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl border px-3 text-[15px] font-bold transition-colors",
              value === k ? "border-primary bg-tint text-primary" : error ? "border-danger bg-surface text-ink" : "border-line bg-surface text-ink hover:border-primary",
            )}
          >
            {value === k && (
              <svg viewBox="0 0 24 24" className="mr-1.5 size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {t(`wallet.form.${k}`)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="m-0 mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
