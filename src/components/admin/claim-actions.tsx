"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { resolveCopyClaim } from "@/lib/claims/actions";
import { CLAIM_DECISIONS, type ClaimDecision } from "@/lib/claims/rules";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/** A-13: reject a copy claim, or uphold it with a correction, a fine or a ban (BLUEPRINT §7.6). */
export function ClaimActions({ claimId, balance }: { claimId: string; balance: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [decision, setDecision] = useState<ClaimDecision | null>(null);
  const [note, setNote] = useState("");
  const [fine, setFine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = () =>
    start(async () => {
      if (!decision) return;
      setError(null);
      const res = await resolveCopyClaim({ claimId, decision, fine: Number(fine) || 0, note });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      toast(t("admin.claims.done"));
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("admin.claims.decision")}>
        {CLAIM_DECISIONS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={decision === d}
            onClick={() => setDecision(d)}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors",
              decision === d ? (d === "rejected" ? "bg-ink text-white ring-ink" : "bg-danger text-white ring-danger") : "bg-surface text-ink ring-line hover:ring-primary",
            )}
          >
            {t(`admin.claims.decisions.${d}`)}
          </button>
        ))}
      </div>
      {decision && (
        <>
          <p className="text-sm text-muted">{t(`admin.claims.explain.${decision}`)}</p>
          {decision === "fine" && (
            <TextField
              label={t("admin.claims.fine")}
              hint={t("admin.claims.fineHint", { balance })}
              type="number"
              inputMode="numeric"
              min={1}
              value={fine}
              onChange={(e) => setFine(e.target.value)}
            />
          )}
          <TextAreaField label={t("admin.claims.note")} hint={t("admin.claims.noteHint")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button variant={decision === "rejected" ? "primary" : "danger"} onClick={run} loading={busy} disabled={note.trim().length < 5}>
            {t("admin.claims.confirm")}
          </Button>
        </>
      )}
    </div>
  );
}
