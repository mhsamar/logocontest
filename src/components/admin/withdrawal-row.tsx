"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { markWithdrawalPaid, rejectWithdrawal } from "@/lib/wallet/actions";
import { useReadOnly } from "./read-only";

/** Admin: pay a withdrawal by hand (record the transaction ID) or reject it (money goes back). */
export function WithdrawalActions({ id }: { id: string }) {
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
      <div className="flex gap-2">
        <Button size="md" onClick={() => (setValue(""), setMode("pay"))}>
          {t("admin.withdrawals.markPaid")}
        </Button>
        <Button size="md" variant="danger" onClick={() => (setValue(""), setMode("reject"))}>
          {t("admin.withdrawals.reject")}
        </Button>
      </div>
    );
  return (
    <div className="w-full space-y-2 sm:w-72">
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
