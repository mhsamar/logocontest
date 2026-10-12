"use client";

import { useState, useTransition } from "react";
import { revealIdNumber } from "@/lib/agreements/admin-actions";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

/** A-13: the masked ID number, with "Show full number" (each reveal is logged). */
export function RevealId({ designerId, masked }: { designerId: string; masked: string }) {
  const readOnly = useReadOnly();
  const { t } = useI18n();
  const [full, setFull] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, start] = useTransition();
  if (readOnly) return <span className="font-mono text-[17px] font-semibold tracking-[.06em] text-ink">{masked}</span>;
  // Design/agreements (owner, 2026-10-12): the number on the left, the button on the right.
  return (
    <span className="flex w-full flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5">
      <span className="font-mono text-[17px] font-semibold tracking-[.06em] text-ink">{full ?? masked}</span>
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
          className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[#E3E4E8] bg-white px-3 text-sm font-bold text-primary disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {failed ? t("admin.agreements.revealFailed") : t("admin.agreements.reveal")}
        </button>
      )}
    </span>
  );
}
