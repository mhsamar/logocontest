"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { startProCheckout } from "@/lib/pro/actions";
import { Icon } from "./parts";
import { proEvent } from "./upgrade-link";

/**
 * Pro checkout (owner, 2026-10-13; Design/pro/pro-checkout.html): bKash or card, an optional promo code, the
 * renewal tick, then "Paying" while the browser moves to the gateway's secure page. The amount is worked out on the
 * server; the browser only sends the choices. Leaving without paying is counted as "closed checkout".
 */
export function CheckoutForm({ amountLabel, priceLabel, trialDays, renew }: { amountLabel: string; priceLabel: string; trialDays: number; renew: boolean }) {
  const { t, locale } = useI18n();
  const [method, setMethod] = useState<"bkash" | "card">("bkash");
  const [promo, setPromo] = useState("");
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
      const res = await startProCheckout({ method, promo: promo.trim() || undefined, acceptedTerms: agree });
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
      {trialDays === 0 && (
        <fieldset className="ck-pms">
          <legend className="sr-only">{t("pro.checkout.lead")}</legend>
          {(["bkash", "card"] as const).map((m) => (
            <label key={m} className="ck-pm">
              <input type="radio" name="pm" checked={method === m} onChange={() => setMethod(m)} />
              <span className="ck-pmi" style={{ background: m === "bkash" ? "#E2136E" : "#1F2A44" }} aria-hidden>
                {m === "bkash" ? "b" : <Icon name="wallet" size={22} />}
              </span>
              <span>
                <b>{t(`pro.checkout.${m}`)}</b>
                <em>{t(`pro.checkout.${m}Sub`)}</em>
              </span>
              <i className="ck-rd" aria-hidden />
            </label>
          ))}
        </fieldset>
      )}
      {trialDays === 0 && (
        <label className="ck-promo">
          {t("pro.checkout.promo")}
          <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} autoComplete="off" />
        </label>
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
      <button type="button" className="ck-payb" onClick={pay} disabled={busy || !agree}>
        <Icon name="lock" size={20} />
        {trialDays > 0 ? t("pro.checkout.payTrial", { days: n(trialDays) }) : promo ? t("pro.go.upgrade") : t("pro.checkout.pay", { amount: amountLabel })}
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
