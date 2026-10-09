"use client";

import { useState, useTransition } from "react";
import { revealIdNumber } from "@/lib/agreements/admin-actions";
import { useI18n } from "@/lib/i18n/client";

/** A-13: the masked ID number, with "Show full number" (each reveal is logged). */
export function RevealId({ designerId, masked }: { designerId: string; masked: string }) {
  const { t } = useI18n();
  const [full, setFull] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-ink">{full ?? masked}</span>
      {!full && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const res = await revealIdNumber(designerId);
              if (res.ok) setFull(res.idNumber);
              else setFailed(true);
            })
          }
          className="min-h-9 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {failed ? t("admin.agreements.revealFailed") : t("admin.agreements.reveal")}
        </button>
      )}
    </span>
  );
}
