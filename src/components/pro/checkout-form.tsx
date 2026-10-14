"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { showMobile, type PublicMethod } from "@/lib/payments/manual-rules";
import { startProCheckout } from "@/lib/pro/actions";
import { previewProPromo } from "@/lib/promos/actions";
import { Icon } from "./parts";
import { proEvent } from "./upgrade-link";

/**
 * Pro checkout (owner, 2026-10-13; Design/pro/pro-checkout.html): the payment methods switched on in Admin ›
 * Payments › Methods (owner, 2026-10-14), an optional promo code, the renewal tick, then "Paying" while the browser
 * moves to the gateway's secure page or the bKash pay page. The amount is worked out on the server; the browser only
 * sends the choices. Leaving without paying is counted as "closed checkout".
 */
export function CheckoutForm({ amountLabel, priceLabel, trialDays, renew, methods }: { amountLabel: string; priceLabel: string; trialDays: number; renew: boolean; methods: PublicMethod[] }) {
  const { t, locale, price, currency } = useI18n();
  const [method, setMethod] = useState<string | null>(methods[0]?.key ?? null);
  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState<{ code: string; amount: number; percent: number | null } | null>(null);
  const [checking, check] = useTransition();
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [busy, start] = useTransition();
  const leaving = useRef(false);

  // Closed the page without paying (Admin › Pro plan › Where they stop).
  useEffect(() => {
    const onHide = () => {
      if (!leaving.current && document.visibilityState === "hidden") proEvent("checkout_closed", "checkout");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const pay = () =>
    start(async () => {
      setError(null);
      const res = await startProCheckout({ method: method ?? "", promo: promo.trim() || undefined, acceptedTerms: agree });
      if (!res.ok) {
        setError(t(res.error));
        return;
      }
      leaving.current = true;
      setPaying(true);
      window.location.assign(res.redirectUrl);
    });

  if (paying)
    return (
      <section className="ck-pay center" aria-live="polite">
        <div className="ck-spin">
          <span />
          <Icon name="lock" size={34} />
        </div>
        <h1>{t("pro.checkout.payingTitle")}</h1>
        <p className="ck-ps">{t("pro.checkout.payingLead")}</p>
        <div className="ck-steps">
          <span className="ok">
            <Icon name="check" size={16} strokeWidth={2.8} />
            {t("pro.checkout.s1")}
          </span>
          <span className="now">
            <i />
            {t("pro.checkout.s2")}
          </span>
          <span>{t("pro.checkout.s3")}</span>
        </div>
      </section>
    );

  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v);
  return (
    <section className="ck-pay">
      <h1>{renew ? t("pro.checkout.renewTitle") : t("pro.checkout.title")}</h1>
      <p className="ck-ps">{t("pro.checkout.lead")}</p>
      {trialDays === 0 && methods.length === 0 && (
        <p className="ck-err" role="status">
          {t(currency.code === "USD" ? "pay.methods.noneUsd" : "pay.methods.none")}
        </p>
      )}
      {trialDays === 0 && methods.length > 0 && (
        <fieldset className="ck-pms">
          <legend className="sr-only">{t("pro.checkout.lead")}</legend>
          {methods.map((m) => (
            <label key={m.key} className="ck-pm" data-method={m.key}>
              <input type="radio" name="pm" checked={method === m.key} onChange={() => setMethod(m.key)} />
              <span className="ck-pmi" style={{ background: m.key === "stripe" ? "#635BFF" : m.key === "sslcommerz" ? "#1F2A44" : "#E2136E" }} aria-hidden>
                {m.key === "sslcommerz" || m.key === "stripe" ? <Icon name="wallet" size={22} /> : "b"}
              </span>
              <span>
                <b>{t(`pay.methods.${m.key}`)}</b>
                <em>{m.key === "stripe" ? t("pay.methods.stripeHint") : m.manual ? `${t("pay.methods.manualHint")}${m.number ? ` · ${showMobile(m.number)}` : ""}` : t("pay.methods.autoHint")}</em>
              </span>
              <i className="ck-rd" aria-hidden />
            </label>
          ))}
        </fieldset>
      )}
      {trialDays === 0 && (
        <div className="ck-promo">
          <label htmlFor="ck-promo-code">{t("pro.checkout.promo")}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="ck-promo-code"
              style={{ flex: "1 1 auto", minWidth: 0 }}
              value={promo}
              onChange={(e) => (setPromo(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24)), setApplied(null))}
              autoComplete="off"
            />
            <button
              type="button"
              className="ck-apply"
              disabled={!promo.trim() || checking}
              onClick={() =>
                check(async () => {
                  setError(null);
                  const res = await previewProPromo(promo);
                  if (!res.ok) return setError(t(res.error));
                  setApplied({ code: res.code, amount: res.amount, percent: res.percent });
                })
              }
            >
              {t("pay.promo.apply")}
            </button>
          </div>
          {applied && (
            <span className="ck-applied" data-promo-applied={applied.code}>
              {applied.percent !== null ? t("pay.promo.proApplied", { code: applied.code, percent: n(applied.percent) }) : applied.code} · {price(applied.amount)}
            </span>
          )}
        </div>
      )}
      <label className="ck-agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          {trialDays > 0 ? t("pro.checkout.agreeTrial", { price: priceLabel }) : t("pro.checkout.agree", { price: priceLabel })}{" "}
          <Link href="/legal/terms">{t("pro.checkout.terms")}</Link>
        </span>
      </label>
      {error && (
        <p className="ck-err" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="ck-payb" onClick={pay} disabled={busy || !agree || (trialDays === 0 && !method)}>
        <Icon name="lock" size={20} />
        {trialDays > 0 ? t("pro.checkout.payTrial", { days: n(trialDays) }) : applied ? t("pro.checkout.pay", { amount: price(applied.amount) }) : promo ? t("pro.go.upgrade") : t("pro.checkout.pay", { amount: amountLabel })}
      </button>
      <p className="ck-safe">
        <Icon name="shield" size={18} />
        {t("pro.checkout.safe")}
      </p>
      <Link href="/pro" className="ck-back">
        {t("pro.checkout.back")}
      </Link>
    </section>
  );
}
