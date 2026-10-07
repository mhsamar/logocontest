"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { Price } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { formatTaka } from "@/lib/money";

function Rows({ price, feePercent }: { price: Price; feePercent: number }) {
  const { t, locale } = useI18n();
  const row = (key: string, label: string, amount: number, strong = false) => (
    <div key={key} className={cx("flex items-baseline justify-between gap-4 py-1.5", strong && "border-t border-line pt-3 font-semibold text-ink")}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className={cx("tabular-nums", strong ? "text-lg" : "text-ink")}>{formatTaka(amount, locale)}</dd>
    </div>
  );
  return (
    <dl className="text-sm">
      {row("prize", t("wizard.summary.prize"), price.prize)}
      {row("fee", t("wizard.summary.fee", { percent: feePercent }), price.serviceFee)}
      {price.upgrades.map((u) => row(u.key, t(`wizard.upgrades.${u.key}.name`), u.price))}
      {row("total", t("wizard.summary.total"), price.total, true)}
    </dl>
  );
}

/** Right sidebar from the lg breakpoint (UI-JOURNEY §1.3, §9). */
export function PriceSidebar({ price, feePercent }: { price: Price | null; feePercent: number }) {
  const { t } = useI18n();
  if (!price) return null;
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 rounded-lg bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="mb-3 text-base font-semibold text-ink">{t("wizard.summary.title")}</h2>
        <Rows price={price} feePercent={feePercent} />
      </div>
    </aside>
  );
}

/** Compact total above the Next button on phones, expandable to the full breakdown. */
export function PriceBar({ price, feePercent }: { price: Price | null; feePercent: number }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  if (!price) return null;
  return (
    <div className="lg:hidden">
      {open && (
        <div className="mb-2 rounded-md bg-canvas px-3 py-2">
          <Rows price={price} feePercent={feePercent} />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between text-sm"
      >
        <span className="text-muted">{open ? t("wizard.summary.hide") : t("wizard.summary.show")}</span>
        <span className="font-semibold text-ink">
          {t("wizard.summary.total")} {formatTaka(price.total, locale)}
        </span>
      </button>
    </div>
  );
}
