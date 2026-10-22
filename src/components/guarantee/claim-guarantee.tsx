"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, TextAreaField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { claimGuarantee } from "@/lib/guarantee/actions";
import { CHECK_NOTE_MIN, CLAIM_NOTE_MAX } from "@/lib/guarantee/rules";
import { useI18n } from "@/lib/i18n/client";

/**
 * C-25 money-back claim (owner, 2026-10-21; BLUEPRINT §7.10): the button and its form. "check" asks the team to
 * check the count when enough designers were counted (a reason is then needed).
 */
export function ClaimGuarantee({
  contestId,
  check,
  designers,
  min,
  amount,
  card,
  gateway,
  late = false,
  needsNumber,
  suggestedNumber,
  label,
  className,
}: {
  contestId: string;
  check: boolean;
  designers: number;
  min: number;
  /** What goes back, already written out (৳4,250, or with the dollars for a card payment). */
  amount: string;
  /** Part of it was paid by card (Stripe) or through an automatic gateway: it goes back the same way. */
  card: boolean;
  gateway: boolean;
  /** A late claim (no-result end): there is no winner to pick anyway. */
  late?: boolean;
  needsNumber: boolean;
  suggestedNumber: string | null;
  label: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [refundTo, setRefundTo] = useState(suggestedNumber ? suggestedNumber.replace(/^\+?88/, "") : "");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const ready = agree && (!needsNumber || refundTo.trim().length >= 11) && (!check || note.trim().length >= CHECK_NOTE_MIN);

  const send = () =>
    start(async () => {
      setError(null);
      const res = await claimGuarantee({ contestId, refundTo, note, check, agree });
      if (!res.ok) return setError(t(res.error));
      setOpen(false);
      toast(t("guarantee.modal.sent"));
      router.refresh();
    });

  return (
    <>
      <button type="button" onClick={() => (setError(null), setOpen(true))} className={className} data-guarantee-claim={check ? "check" : "claim"}>
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t(check ? "guarantee.modal.checkTitle" : "guarantee.modal.title")}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={send} loading={busy} disabled={!ready}>
              {t("guarantee.modal.submit")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink">{t(check ? "guarantee.modal.checkBody" : designers === 0 ? "guarantee.modal.bodyNone" : designers === 1 ? "guarantee.modal.bodyOne" : "guarantee.modal.body", { count: num.format(designers), n: num.format(min), amount })}</p>
          <p className="rounded-2xl bg-[#fff6d6] px-4 py-3 text-sm text-gold-ink">{t(late ? "guarantee.modal.loseLate" : "guarantee.modal.lose")}</p>
          {needsNumber && (
            <TextField label={t("guarantee.modal.bkash")} hint={t("guarantee.modal.bkashHint")} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={refundTo} onChange={(e) => setRefundTo(e.target.value)} maxLength={16} />
          )}
          {card && <p className="text-sm text-muted">{t("guarantee.modal.card")}</p>}
          {gateway && <p className="text-sm text-muted">{t("guarantee.modal.gateway")}</p>}
          <TextAreaField
            label={check ? t("guarantee.modal.checkNote", { n: num.format(CHECK_NOTE_MIN) }) : t("guarantee.modal.note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={CLAIM_NOTE_MAX}
            rows={3}
            counterLabel={`${num.format(note.length)} / ${num.format(CLAIM_NOTE_MAX)}`}
          />
          <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label={t("guarantee.modal.agree")} />
          <Link href="/legal/payment-refund#guarantee" target="_blank" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t("guarantee.card.how")}
          </Link>
        </div>
      </Modal>
    </>
  );
}
