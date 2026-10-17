"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { CheckDialog } from "./check-dialog";
import type { Verdict } from "@/lib/logo-check/rules";
import { ShieldIcon, VerdictPill } from "./parts";

/**
 * "See full report" (owner, 2026-10-16): the whole AI report of a finished check (what the AI sees, the similar
 * logos, the closest one side by side, scores, the certificate) for the client, the design's designer and admins.
 * It opens in its own top-layer dialog, so it also shows above the send pop-up.
 */
export function FullReportButton({
  checkId,
  label,
  variant = "outline",
  verdict = null,
  className,
}: {
  checkId: string;
  label?: string;
  /** "card" (owner, 2026-10-18): a full-width card with the shield, the result and an arrow, for the design viewer. */
  variant?: "outline" | "solid" | "link" | "card";
  verdict?: Verdict | null;
  className?: string;
}) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, dialog]);

  const trigger =
    variant === "card" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-full-report={checkId}
        className={cx(
          "group flex w-full items-center gap-3.5 rounded-[18px] bg-surface p-3 pr-3.5 text-left ring-1 ring-line transition-[box-shadow,background-color] hover:bg-tint/40 hover:ring-primary/40 hover:shadow-[0_8px_22px_-14px_rgba(139,0,0,0.45)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[image:var(--gradient-red)] text-white shadow-[0_6px_14px_-6px_rgba(139,0,0,0.6)]">
          <ShieldIcon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15.5px] font-bold leading-tight text-ink">{label ?? t("checker.full.cardTitle")}</span>
            {verdict && <VerdictPill verdict={verdict} className="px-2 text-[12px]" />}
          </span>
          <span className="mt-1 block text-[13.5px] leading-snug text-muted">{t("checker.full.cardLead")}</span>
        </span>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-full-report={checkId}
        className={cx(
          "inline-flex min-h-11 items-center justify-center gap-2 font-bold transition-colors",
          variant === "solid" && "rounded-[14px] bg-ink px-5 text-[15px] text-white hover:bg-ink/85",
          variant === "outline" && "rounded-[14px] bg-surface px-4 text-[15px] text-primary ring-1 ring-primary/40 hover:bg-tint",
          variant === "link" && "px-1 text-[14px] text-primary hover:underline",
          className,
        )}
      >
        <ShieldIcon className="size-4" />
        {label ?? t("checker.full.open")}
      </button>
    );

  return (
    <>
      {trigger}
      <dialog
        ref={setDialog}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
      >
        {open && dialog && <CheckDialog setup={null} lens={false} initial={{ checkId, step: 3 }} onClose={() => setOpen(false)} container={dialog} refreshOnDone={false} />}
      </dialog>
    </>
  );
}
