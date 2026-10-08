"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import type { Brief, Order } from "@/lib/contests/brief";
import type { Price } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/money";

export type UploadState = { name: string; status: "waiting" | "uploading" | "done" | "error" };

// C-11
export function ReviewStep({
  brief,
  order,
  price,
  feePercent,
  name,
  onName,
  method,
  onMethod,
  terms,
  onTerms,
  uploads,
  onRetryUploads,
  goTo,
  nameError,
}: {
  brief: Brief;
  order: Order;
  price: Price;
  feePercent: number;
  name: string;
  onName: (v: string) => void;
  method: "bkash" | "card" | null;
  onMethod: (m: "bkash" | "card") => void;
  terms: boolean;
  onTerms: (v: boolean) => void;
  uploads: UploadState[];
  onRetryUploads: () => void;
  goTo: (step: number) => void;
  nameError?: string;
}) {
  const { t, locale } = useI18n();
  const taka = (n: number) => formatTaka(n, locale);
  const failed = uploads.some((u) => u.status === "error");

  const recap: { step: number; label: string; value: string }[] = [
    { step: 1, label: t("wizard.c11.recap.brand"), value: [brief.brandName, brief.shortName, brief.logoText, brief.slogan].filter(Boolean).join(" · ") },
    { step: 2, label: t("wizard.c11.recap.business"), value: brief.businessType ? t(`wizard.businessTypes.${brief.businessType}`) : "" },
    { step: 2, label: t("wizard.c11.recap.audience"), value: brief.targetAudience },
    { step: 3, label: t("wizard.c11.recap.website"), value: brief.noWebsite || !brief.websiteUrl ? t("wizard.c11.recap.none") : brief.websiteUrl },
    { step: 4, label: t("wizard.c11.recap.styles"), value: brief.styles.map((s) => t(`wizard.styles.${s}`)).join(", ") },
    {
      step: 5,
      label: t("wizard.c11.recap.colours"),
      value: brief.letDesignersChoose ? t("wizard.c05.letChoose") : brief.colors.join(" ").toUpperCase(),
    },
    {
      step: 5,
      label: t("wizard.c11.recap.needs"),
      value: brief.deliverables.length ? brief.deliverables.map((d) => t(`wizard.deliverables.${d}.title`)).join(", ") : t("wizard.c11.recap.none"),
    },
    {
      step: 6,
      label: t("wizard.c11.recap.requirements"),
      value: [...brief.requirements.map((r) => t(`wizard.requirements.${r}`)), brief.requirementsNote].filter(Boolean).join(" · ") || t("wizard.c11.recap.none"),
    },
    {
      step: 8,
      label: t("wizard.c11.recap.package"),
      value: `${t(`wizard.packages.${order.package}.name`)} · ${t("wizard.c08.days", { days: order.durationDays })}`,
    },
  ];

  return (
    <div className="space-y-8">
      <TextField
        label={t("wizard.c11.nameLabel")}
        hint={t("wizard.c11.nameHint")}
        autoComplete="name"
        value={name}
        onChange={(e) => onName(e.target.value)}
        maxLength={80}
        error={nameError}
      />

      <details className="group rounded-lg bg-surface ring-1 ring-line">
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
        <div className="rounded-lg bg-surface p-4 ring-1 ring-line">
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

      <div className="rounded-lg bg-surface p-4 ring-1 ring-line">
        <dl className="text-sm">
          {[
            [t("wizard.summary.prize"), price.prize],
            [t("wizard.summary.fee", { percent: feePercent }), price.serviceFee],
            ...price.upgrades.map((u) => [t(`wizard.upgrades.${u.key}.name`), u.price] as const),
          ].map(([label, amount]) => (
            <div key={label} className="flex justify-between py-1.5">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums text-ink">{taka(amount as number)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-3 font-semibold text-ink">
            <dt>{t("wizard.summary.total")}</dt>
            <dd className="text-lg tabular-nums">{taka(price.total)}</dd>
          </div>
        </dl>
      </div>

      <fieldset>
        <legend className="mb-3 text-base font-semibold text-ink">{t("wizard.c11.methodTitle")}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["bkash", "card"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMethod(m)}
              aria-pressed={method === m}
              className={cx(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg bg-surface ring-1",
                method === m ? "ring-2 ring-primary" : "ring-line hover:ring-muted/40",
              )}
            >
              <span className={cx("text-base font-bold", m === "bkash" ? "text-[#e2136e]" : "text-ink")}>{t(`wizard.c11.${m}`)}</span>
              <span className="text-xs text-muted">{t(`wizard.c11.${m}Hint`)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <Checkbox
        checked={terms}
        onChange={(e) => onTerms(e.target.checked)}
        label={
          <>
            {t("wizard.c11.termsBefore")}{" "}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-primary underline">
              {t("footer.terms")}
            </Link>{" "}
            {t("wizard.c11.termsAfter")}
          </>
        }
      />
    </div>
  );
}
