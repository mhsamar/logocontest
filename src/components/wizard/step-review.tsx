"use client";

import Link from "next/link";
import { MethodPicker, PromoField, type AppliedPromo } from "@/components/payments/pay-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { briefLinks, WIZARD_STEPS as S, type Brief, type Order } from "@/lib/contests/brief";
import type { Price } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { formatTaka } from "@/lib/money";
import { useI18n } from "@/lib/i18n/client";
import type { PublicMethod } from "@/lib/payments/manual-rules";

export type UploadState = { name: string; status: "waiting" | "uploading" | "done" | "error" };

/** A client fee code checked on the server (owner, 2026-10-14): the new fee, and the total with it. */
export type PromoPreview = { code: string; fee: number; normal: number; serviceFee: number; total: number; saves: number };

// C-11
export function ReviewStep({
  brief,
  order,
  price,
  feePercent,
  methods,
  method,
  onMethod,
  promo,
  onApplyPromo,
  onRemovePromo,
  terms,
  onTerms,
  uploads,
  onRetryUploads,
  goTo,
  addonsFreeFrom = 0,
}: {
  brief: Brief;
  order: Order;
  price: Price;
  feePercent: number;
  methods: PublicMethod[];
  method: string | null;
  onMethod: (m: string) => void;
  promo: PromoPreview | null;
  onApplyPromo: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onRemovePromo: () => void;
  terms: boolean;
  onTerms: (v: boolean) => void;
  uploads: UploadState[];
  onRetryUploads: () => void;
  goTo: (step: number) => void;
  /** Every add-on is free from this prize (owner, 2026-10-22; Admin › Pricing); 0 = never. */
  addonsFreeFrom?: number;
}) {
  const { t, locale, currency, price: taka } = useI18n();
  const failed = uploads.some((u) => u.status === "error");
  const links = briefLinks(brief);

  const recap: { step: number; label: string; value: string }[] = [
    { step: S.logo, label: t("wizard.c11.recap.brand"), value: [brief.brandName, brief.shortName, brief.logoText, brief.slogan].filter(Boolean).join(" · ") },
    {
      step: S.business,
      label: t("wizard.c11.recap.business"),
      value: brief.businessType === "other" && brief.businessTypeOther ? brief.businessTypeOther : brief.businessType ? t(`wizard.businessTypes.${brief.businessType}`) : "",
    },
    { step: S.business, label: t("wizard.c11.recap.audience"), value: brief.targetAudience },
    { step: S.links, label: t("wizard.c11.recap.website"), value: links.length ? links.map((l) => l.url.replace(/^https?:\/\//, "")).join(" · ") : t("wizard.c11.recap.none") },
    { step: S.links, label: t("wizard.c11.recap.competitors"), value: brief.competitors?.trim() || t("wizard.c11.recap.none") },
    { step: S.look, label: t("wizard.c11.recap.styles"), value: brief.styles.map((s) => t(`wizard.styles.${s}`)).join(", ") },
    {
      step: S.look,
      label: t("wizard.c11.recap.colours"),
      value: brief.letDesignersChoose ? t("wizard.c05.letChoose") : brief.colors.join(" ").toUpperCase(),
    },
    {
      step: S.needs,
      label: t("wizard.c11.recap.needs"),
      value: brief.deliverables.length ? brief.deliverables.map((d) => t(`wizard.deliverables.${d}.title`)).join(", ") : t("wizard.c11.recap.none"),
    },
    {
      step: S.needs,
      label: t("wizard.c11.recap.requirements"),
      value: [...brief.requirements.map((r) => t(`wizard.requirements.${r}`)), brief.requirementsNote].filter(Boolean).join(" · ") || t("wizard.c11.recap.none"),
    },
    {
      step: S.prize,
      label: t("wizard.c11.recap.package"),
      value: `${t(`wizard.packages.${order.package}.name`)} · ${t("wizard.c08.days", { days: order.durationDays })}`,
    },
  ];

  return (
    <div className="space-y-8">

      <details className="group rounded-[20px] border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold text-ink">
          {t("wizard.c11.recapTitle")}
          <svg viewBox="0 0 24 24" className="size-5 text-muted transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <dl className="divide-y divide-line border-t border-line">
          {recap.map((r) => (
            <div key={r.label} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">{r.label}</dt>
                <dd className="mt-0.5 line-clamp-2 break-words text-sm text-ink">{r.value || "—"}</dd>
              </div>
              <button type="button" onClick={() => goTo(r.step)} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-primary hover:underline">
                {t("wizard.c11.edit")}
              </button>
            </div>
          ))}
        </dl>
      </details>

      {uploads.length > 0 && (
        <div className="rounded-[20px] border border-line bg-surface p-5">
          <p className="mb-2 text-sm font-semibold text-ink">{t("wizard.c11.files")}</p>
          <ul className="space-y-1 text-sm">
            {uploads.map((u, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate text-ink">{u.name}</span>
                <span className={cx("shrink-0", u.status === "error" ? "text-danger" : u.status === "done" ? "text-success" : "text-muted")}>
                  {t(`wizard.c11.upload.${u.status}`)}
                </span>
              </li>
            ))}
          </ul>
          {failed && (
            <Button variant="secondary" className="mt-3" onClick={onRetryUploads}>
              {t("wizard.c11.retry")}
            </Button>
          )}
        </div>
      )}

      <div className="rounded-[20px] border border-line bg-surface p-5">
        <dl className="text-sm">
          {[
            [t("wizard.summary.prize"), price.prize],
            [t("wizard.summary.fee", { percent: promo ? promo.fee : feePercent }), promo ? promo.serviceFee : price.serviceFee],
            ...price.upgrades.map((u) => [t(`wizard.upgrades.${u.key}.name`), u.price] as const),
          ].map(([label, amount]) => (
            <div key={label} className="flex justify-between py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums text-ink">{taka(amount as number)}</dd>
            </div>
          ))}
          {/* Free with this prize (owner, 2026-10-22). */}
          {price.freeUpgrades.map((k) => (
            <div key={k} className="flex justify-between py-1.5">
              <dt className="text-muted">{t(`wizard.upgrades.${k}.name`)}</dt>
              <dd className="font-semibold text-success">{t("wizard.summary.free")}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-3 font-semibold text-ink">
            <dt>{t("wizard.summary.total")}</dt>
            <dd className="text-lg tabular-nums">
              {promo && <s className="mr-2 text-sm font-medium text-muted">{taka(price.total)}</s>}
              {taka(promo ? promo.total : price.total)}
            </dd>
          </div>
        </dl>
        {/* The payment section's notice (owner, 2026-10-22): every add-on is free from a prize amount. */}
        {addonsFreeFrom > 0 && (
          <p className={cx("m-0 mt-2 rounded-[12px] px-3 py-2 text-[14px] font-semibold", price.addonsFree ? "bg-success/10 text-success" : "bg-[#FFF8E6] text-[#7A5300]")} role="note" data-addons-free={price.addonsFree ? "on" : "off"}>
            {t(price.addonsFree ? "wizard.summary.addonsFree" : "wizard.summary.addonsFreeTip", { amount: taka(addonsFreeFrom) })}
          </p>
        )}
        {/* Paying in dollars (owner, 2026-10-14): the prize and fees are set in taka; Stripe charges the dollars. */}
        {currency.code === "USD" && <p className="m-0 mt-2 text-[13.5px] text-muted">{t("pay.stripe.usdNote", { usd: taka(promo ? promo.total : price.total), bdt: formatTaka(promo ? promo.total : price.total, locale) })}</p>}
        <div className="mt-3 flex flex-col">
          <PromoField
            applied={promo ? { code: promo.code, line: t("pay.promo.feeApplied", { code: promo.code, fee: promo.fee, normal: promo.normal }), saves: t("pay.promo.saves", { amount: taka(promo.saves) }) } satisfies AppliedPromo : null}
            apply={onApplyPromo}
            onRemove={onRemovePromo}
          />
        </div>
      </div>

      <MethodPicker methods={methods} value={method} onChange={onMethod} title={t("wizard.c11.methodTitle")} />

      <Checkbox
        checked={terms}
        onChange={(e) => onTerms(e.target.checked)}
        label={
          <>
            {t("wizard.c11.termsBefore")}{" "}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-primary underline">
              {t("footer.terms")}
            </Link>{" "}
            {t("wizard.c11.termsAfter")}{" "}
            <Link href="/legal/payment-refund" target="_blank" className="font-semibold text-primary underline">
              {t("footer.refund")}
            </Link>{" "}
            {t("wizard.c11.termsEnd")}
          </>
        }
      />
    </div>
  );
}
