"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { approveAgreement, askForIdPhoto, rejectAgreement, saveAgreementNote, undoAgreementApproval } from "@/lib/agreements/admin-actions";
import type { ReviewStatus } from "@/lib/agreements/queries";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

const BTN = "h-[42px] whitespace-nowrap rounded-[10px] px-4 text-[14.5px] font-bold transition-opacity disabled:opacity-60";

/** "Ask for an ID photo" / "Ask for new photo" (owner, 2026-10-12): an in-app notice and an email to the designer. */
export function AskPhotoButton({ designerId, label, tone = "soft" }: { designerId: string; label: string; tone?: "soft" | "outline" }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const res = await askForIdPhoto(designerId);
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t("admin.agreements.review.asked"));
          router.refresh();
        })
      }
      className={cx(BTN, tone === "soft" ? "h-[38px] bg-[#FBECEB] text-[14px] text-primary" : "border border-[#DCDEE3] bg-white text-ink")}
    >
      {label}
    </button>
  );
}

/** The right column's note and buttons for one agreement (Agreements "manage" only). */
export function AgreementReview({ designerId, status, hasPhoto, note }: { designerId: string; status: ReviewStatus; hasPhoto: boolean; note: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [sheet, setSheet] = useState<"reject" | "noPhoto" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(note);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: Parameters<typeof t>[0] }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) return sheet ? setError(t(res.error)) : toast(t(res.error), "danger");
      after?.();
      setSheet(null);
      toast(t("admin.agreements.review.done"));
      router.refresh();
    });

  return (
    <>
      <label className="flex flex-col gap-1.5 text-[13.5px] font-bold text-ink">
        {t("admin.agreements.note")}
        <textarea
          rows={2}
          maxLength={1000}
          defaultValue={note}
          placeholder={t("admin.agreements.notePlaceholder")}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value === saved.trim()) return;
            start(async () => {
              const res = await saveAgreementNote(designerId, value);
              if (!res.ok) return toast(t(res.error), "danger");
              setSaved(value);
              toast(t("admin.agreements.noteSaved"));
            });
          }}
          className="resize-y rounded-[10px] border border-[#DCDEE3] px-2.5 py-2 text-[14.5px] font-medium focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
      </label>
      <div className="mt-auto flex flex-wrap gap-2">
        {status === "approved" ? (
          <button type="button" disabled={busy} onClick={() => run(() => undoAgreementApproval(designerId))} className={cx(BTN, "border border-[#DCDEE3] bg-white text-ink")}>
            {t("admin.agreements.review.undo")}
          </button>
        ) : (
          <>
            {hasPhoto ? (
              <button type="button" disabled={busy} onClick={() => run(() => approveAgreement(designerId))} className={cx(BTN, "bg-primary text-white")}>
                {t("admin.agreements.review.approve")}
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => (setError(null), setSheet("noPhoto"))} className={cx(BTN, "border border-[#DCDEE3] bg-white text-ink")}>
                {t("admin.agreements.review.approveNoPhoto")}
              </button>
            )}
            {hasPhoto && <AskPhotoButton designerId={designerId} label={t("admin.agreements.askNewPhoto")} tone="outline" />}
            {status !== "rejected" && (
              <button type="button" disabled={busy} onClick={() => (setError(null), setReason(""), setSheet("reject"))} className={cx(BTN, "border border-[#F3C4C0] bg-white text-[#A3121B]")}>
                {t("admin.agreements.review.reject")}
              </button>
            )}
          </>
        )}
      </div>

      <Modal
        open={sheet === "reject"}
        onClose={() => setSheet(null)}
        title={t("admin.agreements.review.rejectTitle")}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={() => run(() => rejectAgreement(designerId, reason))}>
              {t("admin.agreements.review.rejectCta")}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-sm text-muted">{t("admin.agreements.review.rejectBody")}</p>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-bold text-ink">
          {t("admin.agreements.review.reason")}
          <textarea
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("admin.agreements.review.reasonPlaceholder")}
            className="resize-y rounded-xl border border-[#DCDEE3] px-3 py-2.5 text-[15px] font-medium focus:outline-2 focus:outline-offset-1 focus:outline-primary"
          />
        </label>
      </Modal>

      <Modal
        open={sheet === "noPhoto"}
        onClose={() => setSheet(null)}
        title={t("admin.agreements.review.confirmNoPhoto")}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" loading={busy} onClick={() => run(() => approveAgreement(designerId, true))}>
              {t("admin.agreements.review.confirm")}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-sm text-muted">{t("admin.agreements.review.confirmNoPhotoBody")}</p>
      </Modal>
    </>
  );
}
