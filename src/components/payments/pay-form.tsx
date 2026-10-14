"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useI18n } from "@/lib/i18n/client";
import { preparePaymentProof, submitPaymentProof } from "@/lib/payments/manual-actions";
import { isTxnId, normalizeMobile, normalizeTxn } from "@/lib/payments/manual-rules";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const SHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const SHOT_MAX = 5 * 1024 * 1024;

/** Copy a number or an amount with one tap; "Copied" for a moment. */
export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          },
          () => undefined,
        );
      }}
      className="inline-flex min-h-11 shrink-0 items-center rounded-[12px] bg-surface px-3.5 text-[14px] font-bold text-primary ring-1 ring-line hover:ring-primary"
    >
      {copied ? done : label}
    </button>
  );
}

/**
 * The pay page's form (owner, 2026-10-14): the bKash transaction ID, the sender number and a screenshot if they
 * like. The screenshot goes straight to private storage with a one-time link; then the ID is sent for approval.
 */
export function PayForm({ kind, paymentId }: { kind: string; paymentId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [txn, setTxn] = useState("");
  const [sender, setSender] = useState("");
  const [shot, setShot] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ txn?: string; sender?: string; shot?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setErrors((e) => ({ ...e, shot: undefined }));
    if (!f) return setShot(null);
    if (!SHOT_TYPES.includes(f.type)) return setErrors((e) => ({ ...e, shot: t("pay.page.errors.shotType") }));
    if (f.size > SHOT_MAX) return setErrors((e) => ({ ...e, shot: t("pay.page.errors.shotSize") }));
    setShot(f);
  };

  const submit = () => {
    const id = normalizeTxn(txn);
    const next: typeof errors = {};
    if (!isTxnId(id)) next.txn = t("pay.page.errors.txn");
    if (sender.trim() && !normalizeMobile(sender)) next.sender = t("pay.page.errors.sender");
    setErrors(next);
    if (next.txn || next.sender) return;
    start(async () => {
      setError(null);
      let path: string | null = null;
      if (shot) {
        const prepared = await preparePaymentProof({ kind, paymentId, type: shot.type, size: shot.size });
        if (!prepared.ok) return setError(t(prepared.error));
        const { error: upError } = await createBrowserSupabase().storage.from("payment-proofs").uploadToSignedUrl(prepared.path, prepared.token, shot, { contentType: shot.type });
        if (upError) return setError(t("pay.page.errors.shot"));
        path = prepared.path;
      }
      const res = await submitPaymentProof({ kind, paymentId, txnId: id, sender: sender.trim() || undefined, screenshotPath: path });
      if (!res.ok) return setError(t(res.error));
      router.refresh();
    });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <TextField
        label={t("pay.page.txn")}
        hint={t("pay.page.txnHint")}
        error={errors.txn}
        value={txn}
        onChange={(e) => setTxn(e.target.value.toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        className="[&_input]:font-mono [&_input]:tracking-wider"
        required
      />
      <TextField label={t("pay.page.sender")} hint={t("pay.page.senderHint")} error={errors.sender} value={sender} onChange={(e) => setSender(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={16} />
      <div className="space-y-1.5">
        <span className="block text-sm font-semibold text-ink">{t("pay.page.shot")}</span>
        <input ref={fileRef} type="file" accept={SHOT_TYPES.join(",")} className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label={t("pay.page.shot")} />
        {shot ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-[14px] bg-surface px-4 ring-1 ring-inset ring-line">
            <span className="min-w-0 truncate text-[15px] text-ink">{shot.name}</span>
            <button
              type="button"
              className="min-h-11 shrink-0 px-1 text-sm font-bold text-primary"
              onClick={() => {
                setShot(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              {t("pay.page.shotRemove")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-line bg-surface text-[15px] font-bold text-ink hover:border-primary">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />
            </svg>
            {t("pay.page.shotPick")}
          </button>
        )}
        {errors.shot ? (
          <p role="alert" className="text-sm text-danger">
            {errors.shot}
          </p>
        ) : (
          <p className="text-sm text-muted">{t("pay.page.shotHint")}</p>
        )}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" block loading={busy}>
        {t("pay.page.submit")}
      </Button>
    </form>
  );
}
