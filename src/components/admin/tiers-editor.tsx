"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { DesignerTier } from "@/lib/admin/pricing-keys";
import { saveSettings } from "@/lib/admin/site-actions";
import { useI18n } from "@/lib/i18n/client";
import { toAsciiDigits } from "@/lib/phone";
import { useReadOnly } from "./read-only";

const INPUT = "block w-full min-h-10 rounded-lg bg-canvas px-3 text-sm text-ink tabular-nums ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary";

/** Admin › Pricing & fees (owner, 2026-10-22): the designer fee by counted wins, as rows instead of raw JSON. */
export function TiersEditor({ tiers }: { tiers: DesignerTier[] }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const start = tiers.map((x) => ({ wins: String(x.min_wins), rate: String(x.rate_percent) }));
  const [rows, setRows] = useState(start);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(start);
  // Bangla digits (০-৯) are fine; anything else is dropped.
  const set = (i: number, field: "wins" | "rate", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [field]: toAsciiDigits(v).replace(/[^\d]/g, "") } : x)));

  const save = () =>
    run(async () => {
      setError(null);
      // A blank cell would be saved as 0: every row needs both numbers.
      if (rows.some((r) => r.wins === "" || r.rate === "")) return setError(t("admin.pricing.errors.tiers.blank"));
      const value = JSON.stringify(rows.map((r) => ({ min_wins: Number(r.wins), rate_percent: Number(r.rate) })));
      const res = await saveSettings("fees", { "fees.designer_tiers": value }, reason);
      if (!res.ok) return setError(res.errors?.["fees.designer_tiers"] ? `${t(res.error)} (${res.errors["fees.designer_tiers"]})` : t(res.error));
      setReason("");
      toast(t("admin.pricing.tiers.saved"));
      router.refresh();
    });

  return (
    <div className="mt-4">
      <p className="m-0 text-sm text-muted">{t("admin.pricing.tiers.note")}</p>
      <table className="mt-3 w-full max-w-md text-sm" data-tiers>
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-2 font-medium">{t("admin.pricing.tiers.wins")}</th>
            <th className="pb-2 font-medium">{t("admin.pricing.tiers.rate")}</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">
                <input aria-label={`${t("admin.pricing.tiers.wins")} ${i + 1}`} inputMode="numeric" readOnly={readOnly || i === 0} value={r.wins} onChange={(e) => set(i, "wins", e.target.value)} className={INPUT} />
              </td>
              <td className="py-1 pr-2">
                <input aria-label={`${t("admin.pricing.tiers.rate")} ${i + 1}`} inputMode="numeric" readOnly={readOnly} value={r.rate} onChange={(e) => set(i, "rate", e.target.value)} className={INPUT} />
              </td>
              <td className="py-1">
                {!readOnly && i > 0 && (
                  <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} aria-label={t("admin.pricing.tiers.remove", { n: i + 1 })} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-danger">
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <button type="button" onClick={() => setRows((x) => [...x, { wins: String(Number(x.at(-1)?.wins ?? 0) + 10), rate: x.at(-1)?.rate ?? "10" }])} className="mt-2 min-h-10 text-sm font-semibold text-primary hover:underline">
          + {t("admin.pricing.tiers.add")}
        </button>
      )}
      {dirty && (
        <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3">
          <label className="block text-sm font-medium text-ink" htmlFor="r-tiers">
            {t("admin.reason")}
          </label>
          <input id="r-tiers" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.settings.reasonPlaceholder")} className={INPUT} />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} disabled={reason.trim().length < 3}>
              {t("admin.settings.save")}
            </Button>
            <Button variant="ghost" onClick={() => (setRows(start), setError(null))}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
