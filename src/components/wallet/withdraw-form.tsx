"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/money";
import { requestWithdrawal } from "@/lib/wallet/actions";
import type { PayoutMethod } from "@/lib/wallet/queries";

/** D-11 Withdraw: amount with "Max", payout method, then the request (bKash may be sent at once). */
export function WithdrawButton({ balance, min, methods }: { balance: number; min: number; methods: PayoutMethod[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const taka = (n: number) => formatTaka(n, locale);
  const canWithdraw = balance >= min;
  const method = methods.find((m) => m.id === methodId);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await requestWithdrawal({ amount: Math.floor(Number(amount)), methodId });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setDone(res.status === "paid" ? t("wallet.form.sentPaid", { method: method?.label ?? "", txn: res.txnId ?? "" }) : t("wallet.form.sentRequested", { method: method?.label ?? "" }));
      router.refresh();
    });

  return (
    <>
      <Button size="lg" disabled={!canWithdraw} onClick={() => (setError(null), setDone(null), setAmount(String(balance)), setOpen(true))}>
        {t("wallet.withdraw")}
      </Button>
      {!canWithdraw && <p className="mt-2 text-sm text-muted">{t("wallet.minNote", { min: taka(min) })}</p>}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("wallet.form.title")}
        closeLabel={t("common.close")}
        footer={
          done ? (
            <Button block size="lg" onClick={() => setOpen(false)}>
              {t("common.close")}
            </Button>
          ) : methods.length > 0 ? (
            <div className="w-full space-y-2">
              {error && <Alert tone="danger">{error}</Alert>}
              <Button block size="lg" onClick={submit} loading={busy}>
                {t("wallet.form.submit")}
              </Button>
            </div>
          ) : undefined
        }
      >
        {done ? (
          <Alert tone="success">{done}</Alert>
        ) : methods.length === 0 ? (
          <div className="space-y-3">
            <p className="text-ink">{t("wallet.form.noMethod")}</p>
            <Link href="/dashboard/profile" className="font-semibold text-primary hover:underline">
              {t("wallet.form.addMethod")} →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <TextField
                className="flex-1"
                label={t("wallet.form.amount")}
                type="number"
                inputMode="numeric"
                min={min}
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                hint={t("wallet.minNote", { min: taka(min) })}
              />
              <Button variant="secondary" className="mb-6" onClick={() => setAmount(String(balance))}>
                {t("wallet.form.max")}
              </Button>
            </div>
            <SelectField label={t("wallet.form.method")} placeholder={t("wallet.form.method")} value={methodId} onChange={(e) => setMethodId(e.target.value)} options={methods.map((m) => ({ value: m.id, label: m.label }))} />
          </div>
        )}
      </Modal>
    </>
  );
}
