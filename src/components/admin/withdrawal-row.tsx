"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { cx } from "@/lib/cx";
import { markWithdrawalPaid, rejectWithdrawal, setAutoWithdrawals } from "@/lib/wallet/actions";
import { useReadOnly } from "./read-only";

/** Admin: pay a withdrawal by hand (record the transaction ID) or reject it (money goes back). */
export function WithdrawalActions({ id, stacked = false }: { id: string; /** Large buttons one above the other (owner, 2026-10-16). */ stacked?: boolean }) {
  const readOnly = useReadOnly();
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"pay" | "reject" | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const res = mode === "pay" ? await markWithdrawalPaid({ id, txnId: value }) : await rejectWithdrawal({ id, reason: value });
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      toast(mode === "pay" ? t("admin.withdrawals.paid") : t("admin.withdrawals.rejected"));
      setMode(null);
      router.refresh();
    });
  if (readOnly) return null;

  if (!mode)
    return (
      <div className={cx("flex gap-2", stacked && "w-full flex-col")}>
        <Button size={stacked ? "lg" : "md"} block={stacked} onClick={() => (setValue(""), setMode("pay"))}>
          {t("admin.withdrawals.markPaid")}
        </Button>
        <Button size={stacked ? "lg" : "md"} block={stacked} variant="danger" onClick={() => (setValue(""), setMode("reject"))}>
          {t("admin.withdrawals.reject")}
        </Button>
      </div>
    );
  return (
    <div className={cx("w-full space-y-2", !stacked && "sm:w-72")}>
      <TextField label={mode === "pay" ? t("admin.withdrawals.txnLabel") : t("admin.withdrawals.reasonLabel")} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button size="md" variant={mode === "pay" ? "primary" : "danger"} onClick={run} loading={busy}>
          {mode === "pay" ? t("admin.withdrawals.markPaid") : t("admin.withdrawals.confirmReject")}
        </Button>
        <Button size="md" variant="ghost" onClick={() => setMode(null)}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Admin › Withdrawals (owner, 2026-10-15): automatic bKash withdrawals on or off. Locked until the bKash payout API is
 * connected; bank withdrawals always wait here.
 */
export function AutoWithdrawCard({ on: start, ready, canManage }: { on: boolean; ready: boolean; canManage: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly() || !canManage;
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const flip = () =>
    run(async () => {
      const next = !on;
      setError(null);
      setOn(next);
      const res = await setAutoWithdrawals(next);
      if (!res.ok) {
        setOn(!next);
        return setError(t(res.error.key, res.error.params));
      }
      toast(t(next ? "admin.withdrawals.auto.savedOn" : "admin.withdrawals.auto.savedOff"));
      router.refresh();
    });
  return (
    <section className="mt-5 flex flex-col gap-3 rounded-[20px] border border-adm-line bg-surface p-5" data-auto-withdraw>
      <div className="flex items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong className="text-[18px] text-[#e2136e]">{t("admin.withdrawals.auto.title")}</strong>
            <span className={cx("rounded-full px-2 py-0.5 text-[12.5px] font-bold", on ? "bg-[#e7f8f0] text-[#0f6b45]" : "bg-[#eef0f3] text-[#5f626b]")}>{on ? t("admin.withdrawals.auto.on") : t("admin.withdrawals.auto.off")}</span>
          </span>
          <span className="text-[14.5px] text-muted">{t("admin.withdrawals.auto.desc")}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("admin.withdrawals.auto.title")}
          disabled={readOnly || busy || (!on && !ready)}
          onClick={flip}
          className={cx("relative mt-1 block h-[30px] w-[52px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[linear-gradient(180deg,#2BB673,#1F7A4D)]" : "bg-[#D5D7DD]")}
        >
          <span className={cx("absolute left-[3px] top-[3px] size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(17,18,22,.25)] transition-transform duration-300", on && "translate-x-[22px]")} />
        </button>
      </div>
      <p className={cx("m-0 rounded-[12px] px-3.5 py-2.5 text-[14px]", ready ? "bg-[#e7f8f0] text-[#0f6b45]" : "bg-[#f4f5f7] text-[#3a3c45]")}>{ready ? t("admin.withdrawals.auto.ready") : t("admin.withdrawals.auto.notReady")}</p>
      {error && <Alert tone="danger">{error}</Alert>}
    </section>
  );
}
