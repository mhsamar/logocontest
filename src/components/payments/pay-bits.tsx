"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { INPUT } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { showMobile, type PublicMethod } from "@/lib/payments/manual-rules";

/**
 * Payment method cards and the promo code box (owner, 2026-10-14). The methods come from Admin › Payments ›
 * Methods: only the ones switched on (and set up) are shown, in the admin's order.
 */

/** Dark pink of bKash for its name; everything else in the site's colours. */
const BKASH = "text-[#e2136e]";

export function MethodPicker({ methods, value, onChange, title }: { methods: PublicMethod[]; value: string | null; onChange: (key: string) => void; title?: string }) {
  const { t, currency } = useI18n();
  if (methods.length === 0) return <Alert tone="info">{t(currency.code === "USD" ? "pay.methods.noneUsd" : "pay.methods.none")}</Alert>;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-base font-semibold text-ink">{title ?? t("pay.methods.title")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {methods.map((m) => {
          const on = value === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onChange(m.key)}
              aria-pressed={on}
              data-method={m.key}
              className={cx("flex min-h-[72px] min-w-0 items-start gap-3 rounded-[14px] bg-surface p-3.5 text-left ring-1 transition-shadow", on ? "ring-2 ring-primary" : "ring-line hover:ring-muted/40")}
            >
              <span aria-hidden className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-2", on ? "ring-primary" : "ring-line")}>
                {on && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cx("text-[16px] font-bold", m.key.startsWith("bkash") ? BKASH : "text-ink")}>{t(`pay.methods.${m.key}`)}</span>
                <span className="text-[13.5px] leading-snug text-muted">{m.key === "stripe" ? t("pay.methods.stripeHint") : m.manual ? t("pay.methods.manualHint") : t("pay.methods.autoHint")}</span>
                {m.manual && m.number && <span className="font-mono text-[13.5px] font-semibold tabular-nums text-ink">{showMobile(m.number)}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export type AppliedPromo = { code: string; line: string; saves?: string | null };

/** "Have a promo code?" → box with Apply. `apply` checks the code on the server and returns what to show. */
export function PromoField({
  applied,
  apply,
  onRemove,
  disabled,
}: {
  applied: AppliedPromo | null;
  apply: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  if (applied)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#e7f8f0] px-4 py-3 text-[15px] text-[#0f6b45]" data-promo-applied={applied.code}>
        <span className="flex min-w-0 flex-col">
          <strong className="break-words">{applied.line}</strong>
          {applied.saves && <span className="text-sm">{applied.saves}</span>}
        </span>
        <button type="button" onClick={() => (onRemove(), setCode(""), setOpen(false))} className="min-h-11 px-2 text-sm font-bold underline">
          {t("pay.promo.remove")}
        </button>
      </div>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={disabled} className="min-h-11 self-start text-[15px] font-bold text-primary hover:underline disabled:opacity-60">
        {t("pay.promo.have")}
      </button>
    );

  const go = () =>
    start(async () => {
      setError(null);
      const res = await apply(code);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="promo-code" className="text-sm font-semibold text-ink">
        {t("pay.promo.label")}
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && code.trim() && (e.preventDefault(), go())}
          placeholder={t("pay.promo.placeholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          className={cx(INPUT, "min-w-0 flex-1 font-mono uppercase tracking-wide")}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "promo-code-msg" : undefined}
        />
        <Button variant="secondary" onClick={go} loading={busy} disabled={!code.trim() || disabled} className="shrink-0">
          {t("pay.promo.apply")}
        </Button>
      </div>
      {error && (
        <p id="promo-code-msg" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
