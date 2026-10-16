"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { CheckDialog } from "./check-dialog";
import { ShieldIcon } from "./parts";

/**
 * "See full report" (owner, 2026-10-16): the whole AI report of a finished check (what the AI sees, the similar
 * logos, the closest one side by side, scores, the certificate) for the client, the design's designer and admins.
 * It opens in its own top-layer dialog, so it also shows above the send pop-up.
 */
export function FullReportButton({ checkId, label, variant = "outline", className }: { checkId: string; label?: string; variant?: "outline" | "solid" | "link"; className?: string }) {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, dialog]);

  return (
    <>
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
