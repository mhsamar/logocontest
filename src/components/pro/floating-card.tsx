"use client";

import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { proCardWanted, setProCardMinimised } from "@/lib/pro/actions";
import { Icon } from "./parts";
import { StartTrialButton } from "./trial-buttons";
import { proEvent, UpgradeLink } from "./upgrade-link";
import "./floating-card.css";

/**
 * The Go Pro card (owner, 2026-10-13; Design/pro/go-pro-floating-card.html) on every page a Basic designer opens.
 * "–" folds it into a pill; the choice is saved for this designer (every device). Not on the Pro pages themselves.
 */
export function FloatingProCard({ price, checks, minimised: initial, trialDays = null, forSale = true }: { price: string; checks: number; minimised: boolean; /** The free Pro Trial this designer can start (owner, 2026-10-14). */ trialDays?: number | null; forSale?: boolean }) {
  const { t, locale } = useI18n();
  const path = usePathname();
  const [min, setMin] = useState(initial);
  // Gone for good once the designer is Pro or has paid for it (owner, 2026-10-14), without reloading the site.
  const [gone, setGone] = useState(false);
  // Not while paying either (owner, 2026-10-14: the bKash pay page).
  const hidden = gone || path.startsWith("/pro") || path.startsWith("/admin") || path.startsWith("/dev") || path.startsWith("/pay");

  useEffect(() => {
    if (gone) return;
    let live = true;
    void proCardWanted().then((wanted) => {
      if (!live) return;
      if (!wanted) setGone(true);
      else if (!hidden) proEvent("card_seen", min ? "pill" : "card");
    });
    return () => {
      live = false;
    };
    // Once per page view is enough; the server counts one a day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (hidden) return null;
  const fold = (v: boolean) => {
    setMin(v);
    void setProCardMinimised(v);
  };
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(checks);

  if (min)
    return (
      <div className="fc-dock">
        <button type="button" className="fc-pill" onClick={() => fold(false)} aria-label={t("pro.card.open")}>
          <span className="fc-id">
            <Icon name="crown" size={18} />
          </span>
          <span>
            <b>{trialDays ? t("pro.trial.cardTitle", { days: trialDays }) : t("pro.card.pill")}</b>
            <em>{trialDays ? t("pro.trial.cardLead") : `${price} ${t("pro.go.perMonth")}`}</em>
          </span>
          <span className="go">
            <Icon name="arrow" size={16} />
          </span>
        </button>
      </div>
    );

  return (
    <div className="fc-dock open">
      <aside className="fc-card" aria-label={t("pro.card.title")}>
        <div className="fc-top">
          <span className="fc-k">
            <Icon name="crown" size={13} />
            {t("pro.card.kicker")}
          </span>
          <button type="button" className="fc-min" onClick={() => fold(true)} aria-label={t("pro.card.minimise")}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <b className="fc-h">{t("pro.card.title")}</b>
        <span className="fc-s">{t("pro.card.lead")}</span>
        <ul className="fc-l">
          {(["l1", "l2", "l3", "l4"] as const).map((k) => (
            <li key={k}>
              <i>
                <Icon name="check" size={14} strokeWidth={2.8} />
              </i>
              {t(`pro.card.${k}`, { n })}
            </li>
          ))}
        </ul>
        <div className="fc-p">
          <b>{price}</b>
          <span>{t("pro.go.perMonth")}</span>
        </div>
        {trialDays && <StartTrialButton days={trialDays} className="fc-up" />}
        {forSale && (
          <UpgradeLink href="/pro/checkout" step="card" className={trialDays ? "fc-more" : "fc-up"}>
            {t("pro.card.upgrade")}
            {!trialDays && <Icon name="arrow" />}
          </UpgradeLink>
        )}
        <Link href="/pro" className="fc-more">
          {t("pro.card.all")}
        </Link>
      </aside>
      <div className="fc-bar" role="complementary" aria-label={t("pro.card.title")}>
        <span className="fc-id">
          <Icon name="crown" size={16} />
        </span>
        <Link href="/pro">
          <b>{t("pro.card.pill")}</b>
          <em>
            {price} {t("pro.go.perMonth")}
          </em>
        </Link>
        {trialDays ? (
          <StartTrialButton days={trialDays} className="fc-bb" />
        ) : (
          <UpgradeLink href="/pro/checkout" step="bar" className="fc-bb">
            {t("pro.card.phoneUpgrade")}
          </UpgradeLink>
        )}
        <button type="button" className="fc-min" onClick={() => fold(true)} aria-label={t("pro.card.minimise")}>
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}
