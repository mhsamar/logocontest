"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { PayFlow } from "@/components/pay-v3/pay-flow";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { trackPixel } from "@/lib/analytics/meta-pixel";
import type { Order } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import type { V2Payment } from "@/lib/onboarding/v2-actions";
import type { PayV3 } from "@/lib/payments/pay-v3";
import { loadPayV3 } from "@/lib/payments/pay-v3-actions";
import type { V2Actions } from "./wizard-v2";

/**
 * Step 4: bKash only (spec §2). The payment is made for the saved total when the step opens (the same one again if
 * nothing changed). Since 2026-11-06 the new payment flow (owner; Design/logocontest-update): how to send it with the
 * voice guide, how it was sent (bKash app, bank app or another way), then the check until the contest is live. A promo
 * code makes a new payment with the lower amount.
 */
export function PayV2(props: { actions: V2Actions; contestId: string; brandName: string; order: Order; approvalMinutes: number; onBar: (el: HTMLDivElement | null) => void; onBack: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const { actions, contestId } = props;
  const [payment, setPayment] = useState<V2Payment | null>(null);
  const [data, setData] = useState<PayV3 | null>(null);
  const [failed, setFailed] = useState<{ key: MessageKey; params?: MessageParams } | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [code, setCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const load = useCallback(
    (promo: string | null) =>
      start(async () => {
        const res = await actions.openPayment({ contestId, promo });
        if (!res.ok) {
          if (promo) return setPromoError(t(res.error.key, res.error.params));
          return setFailed(res.error);
        }
        const screens = await loadPayV3(res.paymentId);
        if (!screens) return setFailed({ key: "wizardV2.pay.retry" });
        setFailed(null);
        setPromoError(null);
        setPayment(res);
        setData(screens);
      }),
    [actions, contestId, t],
  );
  useEffect(() => load(null), [load]);

  const promo = payment && (
    <div>
      {payment.promo ? (
        <p className="m-0 text-sm font-semibold text-success">{t("wizardV2.pay.promoOn", { code: payment.promo })}</p>
      ) : promoOpen ? (
        <div className="flex items-end gap-2">
          <TextField className="flex-1" label={t("wizardV2.pay.promo")} value={code} maxLength={40} onChange={(e) => setCode(e.target.value.toUpperCase())} error={promoError ?? undefined} autoCapitalize="characters" />
          <Button type="button" variant="secondary" onClick={() => code.trim() && load(code.trim())} loading={busy} className="mb-[2px]">
            {t("wizardV2.pay.promoApply")}
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => setPromoOpen(true)} className="min-h-11 text-sm font-semibold text-primary underline">
          {t("wizardV2.pay.promoAsk")}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {failed && (
        <div className="space-y-3">
          <Alert tone="danger">{t(failed.key, failed.params)}</Alert>
          <Button type="button" variant="secondary" block onClick={() => load(null)} loading={busy}>
            {t("wizardV2.pay.retry")}
          </Button>
        </div>
      )}

      {!data && !failed && (
        <div className="h-48 animate-pulse rounded-2xl bg-chip" aria-busy>
          <span className="sr-only">{t("wizardV2.pay.loading")}</span>
        </div>
      )}

      {data && payment && (
        <PayFlow
          key={data.paymentId}
          data={data}
          briefHref={`/start-v2/brief?c=${contestId}`}
          extra={promo}
          onSent={() => {
            // Meta: the payment details were sent (the Purchase itself is counted once it is approved).
            trackPixel(`addpay:${payment.paymentId}`, "AddPaymentInfo", { value: payment.amount, currency: "BDT" });
            props.onDone();
          }}
        />
      )}

      <div ref={(el) => props.onBar(el)}>
        <Button type="button" variant="ghost" block onClick={props.onBack}>
          {t("wizardV2.back")}
        </Button>
      </div>
    </div>
  );
}
