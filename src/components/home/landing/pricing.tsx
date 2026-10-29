import { Fragment } from "react";
import Link from "@/components/ui/link";
import { getContact } from "@/lib/content/contact";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { cx } from "@/lib/cx";
import { homePayMethods } from "@/lib/home/pay-methods";
import { feeRule, packageCards, payKinds, payStep, payWording, type PackageCard } from "@/lib/home/pricing-cards";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { invitesOpenForClients } from "@/lib/pro/invites-open";
import { visibleOffers } from "@/lib/rewards/visible";
import { getSettings } from "@/lib/settings";
import "./pricing.css";

const Tick = () => (
  <svg aria-hidden className="lc-hp-tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);


type Tone = "light" | "red" | "dark";

/** One of the four cards: name, big prize, the line under it, the ticked lines and the button. */
function Card({ tone, name, prize, sub, lines, badge, children }: { tone: Tone; name: string; prize: string; sub: string; lines: string[]; badge?: string; children: React.ReactNode }) {
  return (
    <div className={cx("lc-hp-card lc-sh", tone !== "light" && `lc-hp-${tone}`)}>
      {badge && <span className="lc-hp-badge">{badge}</span>}
      <div className="lc-hp-top">
        <span className="lc-hp-name">{name}</span>
        <span className="lc-hp-prize lc-d">{prize}</span>
        <span className="lc-hp-sub">{sub}</span>
      </div>
      <ul className="lc-hp-list">
        {lines.map((line) => (
          <li key={line}>
            <Tick />
            {line}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/**
 * Home: "Simple pricing" (owner, 2026-10-29; Design/logocontest-site/index.html), between the live designers and the
 * winners. The design's four cards (Economy, Standard, Premium, Custom) with their prizes from Admin › Pricing, each
 * prize's own fee % and free AI checks, a worked example and where the money goes. A line about something that is off
 * (card payments, Pro invitations, the monthly gift box, the phone) is left out; every amount goes through price().
 */
export async function LandingPricing() {
  const { t, locale, price, currency } = await getI18n();
  const [pricing, s, offers, contact, methods, invites] = await Promise.all([
    getPricingConfig(),
    getSettings(["limits.logo_checks_per_1000", "timers.designer_file_upload_days", "guarantee.enabled", "guarantee.min_designers"]),
    visibleOffers(),
    getContact(locale),
    homePayMethods(currency.code).catch(() => []),
    // The same rule as the band above: a real client could invite someone (owner, 2026-10-29).
    invitesOpenForClients().catch(() => false),
  ]);
  const num = (n: number) => formatNumber(n, locale);
  const per = s["limits.logo_checks_per_1000"];
  const days = s["timers.designer_file_upload_days"];
  const cards = packageCards(pricing, per);
  const standard = cards.find((c) => c.key === "standard")!;
  const rule = feeRule(pricing);
  const kinds = payKinds(methods);
  const pay = payWording(kinds);
  const after = payStep(kinds);
  const largeParams = { fee: num(rule.fee), largeFee: num(rule.largeFee ?? rule.fee), largeFrom: price(rule.largeFrom) };
  const only = (xs: (string | false | null | undefined)[]) => xs.filter((x): x is string => Boolean(x));

  // The fee at each prize's own rate, including the lower one above the threshold (owner, 2026-10-29).
  const lead = only([t("home2.pricing.lead"), rule.largeFee === null ? t("home2.pricing.leadFee", { fee: num(rule.fee) }) : t("home2.pricing.leadFeeLarge", largeParams), pay && t(`home2.pricing.pay.${pay}`)]).join(" ");
  const packageLines = (c: PackageCard) =>
    only([
      t("home2.pricing.toWinner", { prize: price(c.prize) }),
      t("home2.pricing.fee", { pct: num(c.feePercent), fee: price(c.fee) }),
      // Free on every logo contest, N checks per full ৳1,000 of prize (owner, 2026-10-14).
      c.checks > 0 && t(c.checks === 1 ? "home2.pricing.checksOne" : "home2.pricing.checks", { n: num(c.checks) }),
      invites && t("home2.pricing.invite"),
      // The client race's prize is a gift box (owner, 2026-10-20); its switch is still called "smartphone".
      c.key === "premium" && offers.smartphone ? t("home2.pricing.giftBox") : t("home2.pricing.rate"),
    ]);
  const customLines = only([
    t("home2.pricing.custom.setAny", { min: price(pricing.customMin) }),
    per > 0 && t("home2.pricing.custom.checks", { n: num(per), amount: price(1000) }),
    invites && t("home2.pricing.invite"),
    contact.phone && t("home2.pricing.custom.phone"),
    t("home2.pricing.rate"),
  ]);
  const steps = [
    { title: rule.largeFee === null ? t("home2.pricing.safe.step1", { fee: num(rule.fee) }) : t("home2.pricing.safe.step1Large", largeParams), text: only([pay && t(`home2.pricing.safe.payWith.${pay}`), after && t(`home2.pricing.safe.${after}`)]).join(" ") },
    { title: t("home2.pricing.safe.step2"), text: t("home2.pricing.safe.step2Text") },
    { title: t("home2.pricing.safe.step3"), text: t("home2.pricing.safe.step3Text") },
    { title: t("home2.pricing.safe.step4"), text: t(days === 1 ? "home2.pricing.safe.step4TextOne" : "home2.pricing.safe.step4Text", { n: num(days) }) },
  ];
  const blind = pricing.upgradePrices.blind;
  const freeFrom = pricing.addonsFreeFrom ?? 0;
  const notes = only([
    // Every add-on is free from a prize (owner, 2026-10-22), Blind included.
    blind > 0 && (freeFrom > 0 ? t("home2.pricing.notes.blindFree", { price: price(blind), from: price(freeFrom) }) : t("home2.pricing.notes.blind", { price: price(blind) })),
    t(days === 1 ? "home2.pricing.notes.filesOne" : "home2.pricing.notes.files", { n: num(days) }),
    // As the Q&A's refund answer (faq-params.ts): the money-back guarantee is the one exception while it is on.
    s["guarantee.enabled"] ? t("home2.pricing.notes.guarantee", { n: num(s["guarantee.min_designers"]) }) : t("home2.pricing.notes.noRefund"),
  ]);

  return (
    <section id="pricing" aria-labelledby="lc-hp-title" className="lc-hp">
      <div className="lc-hp-in">
        <div className="lc-hp-head">
          <span className="lc-hp-pill">{t("home2.pricing.pill")}</span>
          <h2 id="lc-hp-title" className="lc-hp-title">
            {t("home2.pricing.title")}
          </h2>
          <p className="lc-hp-lead">{lead}</p>
        </div>

        <div className="lc-hp-grid">
          {cards.map((c) => (
            <Card
              key={c.key}
              tone={c.key === "standard" ? "red" : "light"}
              name={t(`home2.pricing.names.${c.key}`)}
              prize={price(c.prize)}
              sub={t("home2.pricing.total", { total: price(c.total) })}
              lines={packageLines(c)}
              badge={c.key === "standard" ? t("home2.pricing.popular") : undefined}
            >
              <Link href="/start/logo" className="lc-hp-btn">
                {t(`home2.pricing.start.${c.key}`)}
              </Link>
            </Card>
          ))}
          <Card tone="dark" name={t("home2.pricing.names.custom")} prize={t("home2.pricing.custom.prize")} sub={rule.largeFee === null ? t("home2.pricing.custom.sub", { fee: num(rule.fee) }) : t("home2.pricing.custom.subLarge", largeParams)} lines={customLines}>
            {contact.phone ? (
              <a href={contact.phoneHref} className="lc-hp-btn">
                {t("home2.pricing.custom.call", { phone: contact.phone })}
              </a>
            ) : (
              <Link href="/start/logo" className="lc-hp-btn">
                {t("home2.pricing.start.custom")}
              </Link>
            )}
          </Card>
        </div>

        {/* Where the money goes: held until the files are in, with the Standard prize as the worked example */}
        <div className="lc-hp-safe lc-sh">
          <div className="lc-hp-safe-txt">
            <span className="lc-hp-held">
              <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t("home2.pricing.safe.pill")}
            </span>
            <h3 className="lc-hp-h3">{t("home2.pricing.safe.title")}</h3>
            <p className="lc-hp-safe-p">{t("home2.pricing.safe.text")}</p>
          </div>
          <ol className="lc-hp-steps">
            {steps.map((step, i) => (
              <li key={step.title} className="lc-hp-step">
                <span aria-hidden className="lc-hp-num lc-d">
                  {num(i + 1)}
                </span>
                <strong>{step.title}</strong>
                <span className="lc-hp-step-p">{step.text}</span>
              </li>
            ))}
          </ol>
          <div className="lc-hp-row">
            <div className="lc-hp-ex">
              <strong>{t("home2.pricing.example.title")}</strong>
              <span className="lc-hp-ex-row">
                <span>{t("home2.pricing.example.prize")}</span>
                <strong>{price(standard.prize)}</strong>
              </span>
              <span className="lc-hp-ex-row">
                <span>{t("home2.pricing.example.fee", { pct: num(standard.feePercent) })}</span>
                <strong>{price(standard.fee)}</strong>
              </span>
              <span className="lc-hp-ex-row lc-hp-ex-total">
                <span>{t("home2.pricing.example.total")}</span>
                <strong className="lc-d">{price(standard.total)}</strong>
              </span>
            </div>
            <div className="lc-hp-why">
              <strong>{t("home2.pricing.why.title")}</strong>
              <ul>
                {[t("home2.pricing.why.prize"), rule.largeFee === null ? t("home2.pricing.why.fee", { fee: num(rule.fee) }) : t("home2.pricing.why.feeLarge"), t("home2.pricing.why.files")].map((line) => (
                  <li key={line}>
                    <Tick />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="lc-hp-notes">
          {notes.map((note, i) => (
            <Fragment key={note}>
              {i > 0 && <span aria-hidden>·</span>}
              <span>{note}</span>
            </Fragment>
          ))}
        </p>
      </div>
    </section>
  );
}
