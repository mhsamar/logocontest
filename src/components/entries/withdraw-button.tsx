"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { withdrawEntry } from "@/lib/entries/actions";
import { useI18n } from "@/lib/i18n/client";

/**
 * The designer removes their own design while the contest is open (owner, 2026-10-11): uploaded by mistake,
 * or they think it isn't good. Asks first; then the design disappears from the contest for everyone.
 */
export function WithdrawButton({ entryId, number, afterHref }: { entryId: string; number: number; afterHref: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(number);

  const remove = () =>
    start(async () => {
      setError(null);
      const res = await withdrawEntry(entryId);
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setOpen(false);
      toast(t("entry.withdraw.done", { n }));
      router.push(afterHref, { scroll: false });
    });

  return (
    <>
      <button
        type="button"
        onClick={() => (setError(null), setOpen(true))}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-muted transition-colors hover:text-danger"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </svg>
        {t("entry.withdraw.action")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("entry.withdraw.title", { n })}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" size="lg" onClick={() => setOpen(false)}>
                {t("entry.withdraw.keep")}
              </Button>
              <Button variant="danger" size="lg" onClick={remove} loading={busy}>
                {t("entry.withdraw.confirm")}
              </Button>
            </div>
          </div>
        }
      >
        <p className="text-ink">{t("entry.withdraw.body")}</p>
      </Modal>
    </>
  );
}
