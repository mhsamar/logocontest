"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { CopyButton, PayForm } from "@/components/payments/pay-form";
import { trackPixel } from "@/lib/analytics/meta-pixel";
import type { Order } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import type { V2Payment } from "@/lib/onboarding/v2-actions";
import { showMobile } from "@/lib/payments/manual-rules";
import type { V2Actions } from "./wizard-v2";

/**
 * Step 4: bKash only (spec §2). The payment is made for the saved total when the step opens (the same one again if
 * nothing changed), then the client sends money, types the Transaction ID (a screenshot if they like) and sends it
 * for approval. A promo code makes a new payment with the lower amount.
 */
export function PayV2(props: { actions: V2Actions; contestId: string; brandName: string; order: Order; approvalMinutes: number; onBar: (el: HTMLDivElement | null) => void; onBack: () => void; onDone: () => void }) {
  const { t, locale } = useI18n();
  const { actions, contestId } = props;
  const taka = (n: number) => formatTaka(n, locale);
  const n = (i: number) => (locale === "bn" ? "০১২৩৪৫৬৭৮৯"[i] : String(i));
  const [payment, setPayment] = useState<V2Payment | null>(null);
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
        setFailed(null);
        setPromoError(null);
        setPayment(res);
      }),
    [actions, contestId, t],
  );
  useEffect(() => load(null), [load]);

  const personal = payment?.method === "bkash_personal";
  const days = props.order.durationDays;

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 mt-2 text-[16px] leading-relaxed text-muted">
        {t("wizardV2.pay.helper", { name: props.brandName, package: t(`wizard.packages.${payment?.package ?? props.order.package}.name`), days: payment?.days ?? days, total: payment ? taka(payment.amount) : "…" })}
      </p>

      {failed && (
        <div className="space-y-3">
          <Alert tone="danger">{t(failed.key, failed.params)}</Alert>
          <Button type="button" variant="secondary" block onClick={() => load(null)} loading={busy}>
            {t("wizardV2.pay.retry")}
          </Button>
        </div>
      )}

      {!payment && !failed && (
        <div className="h-48 animate-pulse rounded-2xl bg-chip" aria-busy>
          <span className="sr-only">{t("wizardV2.pay.loading")}</span>
        </div>
      )}

      {payment && (
        <>
          <ol className="m-0 list-none space-y-4 rounded-2xl bg-tint/50 p-4 ring-1 ring-primary/15">
            <li>
              <p className="m-0 text-[14.5px] text-ink">
                <span className="font-bold">{n(1)}. </span>
                {t(personal ? "wizardV2.pay.sendMoney" : "wizardV2.pay.payment")}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-[14px] bg-surface px-4 py-2.5 ring-1 ring-line">
                <span className="text-[24px] font-semibold tracking-[0.02em] text-ink tabular-nums" data-number>
                  {showMobile(payment.number)}
                </span>
                <CopyButton value={showMobile(payment.number).replace(/-/g, "")} label={t("wizardV2.pay.copy")} done={t("wizardV2.pay.copied")} />
              </div>
              {payment.name && <p className="m-0 mt-1 text-[13px] text-muted">{payment.name}</p>}
            </li>
            <li>
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-[14.5px] text-ink">
                  <span className="font-bold">{n(2)}. </span>
                  {t("wizardV2.pay.amount", { total: taka(payment.amount) })}
                </p>
                <CopyButton value={String(payment.amount)} label={t("wizardV2.pay.copy")} done={t("wizardV2.pay.copied")} />
              </div>
            </li>
            <li>
              <p className="m-0 text-[14.5px] text-ink">
                <span className="font-bold">{n(3)}. </span>
                {t("wizardV2.pay.typeId")}
              </p>
            </li>
          </ol>

          <PayForm
            key={payment.paymentId}
            kind="contest"
            paymentId={payment.paymentId}
            submitLabel={t("wizardV2.pay.send")}
            onDone={() => {
              // Meta: the bKash ID was sent (the Purchase itself is counted once it is approved).
              trackPixel(`addpay:${payment.paymentId}`, "AddPaymentInfo", { value: payment.amount, currency: "BDT" });
              props.onDone();
            }}
          />
          <p className="m-0 text-center text-[13.5px] text-muted">{t("wizardV2.pay.note", { minutes: props.approvalMinutes })}</p>

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
        </>
      )}

      <div ref={(el) => props.onBar(el)}>
        <Button type="button" variant="ghost" block onClick={props.onBack}>
          {t("wizardV2.back")}
        </Button>
      </div>
    </div>
  );
}
