"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/money";
import { requestWithdrawal } from "@/lib/wallet/actions";
import type { PayoutMethod } from "@/lib/wallet/queries";

/**
 * D-11 Withdraw (owner, 2026-10-12): the amount (or "Withdraw all"), then the bKash number with Personal or Agent
 * (filled from the saved one), or a saved bank account; then the request goes to the admins.
 */
export function WithdrawButton({ balance, min, methods }: { balance: number; min: number; methods: PayoutMethod[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const savedBkash = methods.find((m) => m.type === "bkash");
  const banks = methods.filter((m) => m.type === "bank");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [dest, setDest] = useState<string>(savedBkash || banks.length === 0 ? "bkash" : banks[0].id);
  const [number, setNumber] = useState(savedBkash?.bkashNumber ?? "");
  const [kind, setKind] = useState<"personal" | "agent" | "">(savedBkash?.bkashKind ?? "personal");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const taka = (n: number) => formatTaka(n, locale);
  const canWithdraw = balance >= min;
  const bank = banks.find((m) => m.id === dest);
  const label = bank ? bank.label : `${t("wallet.form.bkash")} ${number} (${kind ? t(`wallet.form.${kind}`) : ""})`;

  const submit = () =>
    start(async () => {
      setError(null);
      const value = Math.floor(Number(amount));
      const res = await requestWithdrawal(bank ? { amount: value, methodId: bank.id } : { amount: value, bkash: { number, kind } });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setDone(res.status === "paid" ? t("wallet.form.sentPaid", { method: label, txn: res.txnId ?? "" }) : t("wallet.form.sentRequested", { method: label }));
      router.refresh();
    });

  const choice = (on: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-xl border px-3 text-[15px] font-bold transition-colors ${on ? "border-primary bg-tint text-primary" : "border-line bg-surface text-ink hover:border-primary"}`;

  return (
    <>
      <Button size="lg" variant="secondary" disabled={!canWithdraw} onClick={() => (setError(null), setDone(null), setAmount(String(balance)), setOpen(true))}>
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
          ) : (
            <div className="w-full space-y-2">
              {error && <Alert tone="danger">{error}</Alert>}
              <Button block size="lg" onClick={submit} loading={busy} disabled={!bank && (!number.trim() || !kind)}>
                {t("wallet.form.submit")}
              </Button>
            </div>
          )
        }
      >
        {done ? (
          <Alert tone="success">{done}</Alert>
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
            {banks.length > 0 && (
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-1.5 text-sm font-semibold text-ink">{t("wallet.form.method")}</legend>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={dest === "bkash"} onClick={() => setDest("bkash")} className={choice(dest === "bkash")}>
                    {t("wallet.form.bkash")}
                  </button>
                  {banks.map((b) => (
                    <button key={b.id} type="button" aria-pressed={dest === b.id} onClick={() => setDest(b.id)} className={choice(dest === b.id)}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {!bank && (
              <>
                <TextField label={t("wallet.form.bkashNumber")} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={number} onChange={(e) => setNumber(e.target.value)} />
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-1.5 text-sm font-semibold text-ink">{t("wallet.form.bkashKind")}</legend>
                  <div className="flex gap-2">
                    {(["personal", "agent"] as const).map((k) => (
                      <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={choice(kind === k)}>
                        {kind === k && (
                          <svg viewBox="0 0 24 24" className="mr-1.5 size-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {t(`wallet.form.${k}`)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
