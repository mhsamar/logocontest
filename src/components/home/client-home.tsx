import Link from "next/link";
import { UPGRADE_ICONS, UPGRADE_TINT } from "@/components/wizard/upgrade-meta";
import { DELIVERABLES, PACKAGES, UPGRADES } from "@/lib/contests/brief";
import { countRunningContests } from "@/lib/contests/dashboard";
import { prizeWithFee } from "@/lib/contests/pricing";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { Button, ButtonLink } from "@/components/ui/button";
import { INPUT } from "@/components/ui/field";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, IconBadge, Pill } from "@/components/ui/section-heading";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getSetting } from "@/lib/settings";

const AMOUNT = "lc-d text-primary tracking-[-0.03em]";
const H2 = "m-0 text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink";

const STEP_ICONS = [
  <path key="1" d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5" />,
  <path key="2" d="M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z" />,
  <path key="3" d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
];

/** P-01c Client home (owner, 2026-10-08): everything a returning client needs to start the next contest. */
export async function ClientHome({ user }: { user: { id: string; name: string } }) {
  const { t, locale } = await getI18n();
  const [pricing, perDay, running] = await Promise.all([getPricingConfig(), getSetting("upgrades.extension_price_per_day"), countRunningContests(user.id)]);
  const taka = (n: number) => formatTaka(n, locale);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  return (
    <PageShell>
      {/* Start here */}
      <Panel as="header">
        <div className="max-w-2xl">
          <Pill>{t("clientHome.hi", { name: firstName })}</Pill>
          <h1 className="m-0 mt-4 text-[clamp(32px,4.4vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">{t("clientHome.title")}</h1>
          <p className="m-0 mt-3 text-lg text-muted">{t("clientHome.lead")}</p>
          <form action="/start" className="mt-7 flex flex-col gap-3 sm:flex-row">
            <input name="name" maxLength={60} placeholder={t("clientHome.namePlaceholder")} aria-label={t("clientHome.namePlaceholder")} className={cx(INPUT, "flex-1 bg-chip")} />
            <Button type="submit" size="lg">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("clientHome.start")}
            </Button>
          </form>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1.5 font-bold text-primary hover:underline">
              {t("clientHome.dashboard")} <Arrow />
            </Link>
            <span className="inline-flex items-center gap-2 text-muted">
              {running > 0 && <span className="size-2 rounded-full bg-success" aria-hidden />}
              {running === 0 ? t("clientHome.runningNone") : running === 1 ? t("clientHome.runningOne") : t("clientHome.running", { n: formatNumber(running, locale) })}
            </span>
          </div>
        </div>
      </Panel>

      {/* How it works */}
      <Panel tone="grey">
        <h2 className={cx(H2, "lc-rv")}>{t("clientHome.steps.title")}</h2>
        <ol className="m-0 mt-8 grid list-none gap-3.5 p-0 md:grid-cols-3">
          {(["s1", "s2", "s3"] as const).map((k, i) => (
            <li key={k} className="lc-card lc-rv p-6">
              <div className="flex items-center justify-between gap-3">
                <IconBadge dark={i === 1}>
                  <svg viewBox="0 0 24 24" className="size-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {STEP_ICONS[i]}
                  </svg>
                </IconBadge>
                <span className="lc-d text-[40px] font-semibold leading-none text-line">{formatNumber(i + 1, locale)}</span>
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-ink">{t(`clientHome.steps.${k}.title`)}</h3>
              <p className="mt-1.5 text-muted">{t(`clientHome.steps.${k}.body`)}</p>
            </li>
          ))}
        </ol>
      </Panel>

      {/* Packages */}
      <Panel>
        <h2 className={cx(H2, "lc-rv")}>{t("clientHome.packages.title")}</h2>
        <p className="m-0 mt-2 text-muted">{t("clientHome.packages.sub", { fee: pricing.serviceFeePercent, largeFee: pricing.largeFeePercent, largeFrom: taka(pricing.largeFeeFrom) })}</p>
        <ul className="m-0 mt-8 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6">
          {PACKAGES.map((pkg) => {
            const prize = pkg === "custom" ? null : pricing.packagePrizes[pkg];
            return (
              <li key={pkg} className="lc-rv">
                <Link
                  href="/start"
                  className={cx(
                    "relative flex h-full flex-col rounded-[22px] bg-surface p-4 ring-1 transition-shadow duration-300 hover:shadow-card",
                    pkg === "standard" ? "bg-tint/50 ring-2 ring-primary" : pkg === "elite" ? "ring-[#f1c75c]" : "ring-line",
                  )}
                >
                  {pkg === "standard" && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-[image:var(--gradient-red)] px-2.5 py-0.5 text-[0.6875rem] font-bold text-white">{t("wizard.packages.recommended")}</span>
                  )}
                  <span className={cx("text-sm font-bold", pkg === "elite" ? "text-gold-ink" : "text-muted")}>
                    {pkg === "elite" && "👑 "}
                    {t(`wizard.packages.${pkg}.name`)}
                  </span>
                  <span className={cx("mt-1 text-2xl font-semibold tabular-nums", AMOUNT)}>
                    {prize ? taka(prize) : t("clientHome.packages.customFrom", { min: taka(pricing.customMin) })}
                  </span>
                  <span className="mt-1 text-sm leading-snug text-ink">{t(`wizard.packages.${pkg}.line`)}</span>
                  {prize && <span className="mt-auto pt-2 text-xs text-muted">{t("wizard.packages.youPay", { total: taka(prizeWithFee(prize, pricing)) })}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* Length + what's included */}
      <Panel tone="grey" className="grid gap-3.5 lg:grid-cols-2">
        <div className="lc-card lc-rv p-6 sm:p-8">
          <h2 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-ink">{t("clientHome.length.title")}</h2>
          <p className={cx("m-0 mt-3 text-4xl font-semibold tabular-nums", AMOUNT)}>
            {formatNumber(pricing.durationMin, locale)}–{t("wizard.c08.days", { days: formatNumber(pricing.durationMax, locale) })}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full w-full rounded-full bg-[image:var(--gradient-red)]" />
          </div>
          <p className="m-0 mt-4 text-muted">{t("clientHome.length.body", { min: formatNumber(pricing.durationMin, locale), max: formatNumber(pricing.durationMax, locale), perDay: taka(perDay) })}</p>
        </div>
        <div className="lc-card lc-rv p-6 sm:p-8">
          <h2 className="m-0 text-2xl font-semibold tracking-[-0.03em] text-ink">{t("clientHome.included.title")}</h2>
          <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
            {[t("wizard.c05.always.main"), t("wizard.c05.always.files"), t("clientHome.included.copyright")].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-tint text-primary" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="font-medium text-ink">{line}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-6 text-sm font-bold text-muted">{t("clientHome.included.extras")}</p>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
            {DELIVERABLES.map((d) => (
              <li key={d} className="rounded-full bg-chip px-3 py-1.5 text-sm font-semibold text-ink">
                {t(`wizard.deliverables.${d}.title`)}
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {/* Add-ons */}
      <Panel>
        <h2 className={cx(H2, "lc-rv")}>{t("clientHome.addons.title")}</h2>
        <p className="m-0 mt-2 text-muted">{t("clientHome.addons.sub")}</p>
        <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {UPGRADES.map((u) => (
            <li key={u} className="lc-card lc-rv flex items-start gap-3 rounded-[22px] p-4">
              <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br", UPGRADE_TINT[u])}>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {UPGRADE_ICONS[u]}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold text-ink">{t(`wizard.upgrades.${u}.name`)}</span>
                  <span className={cx("text-sm font-semibold tabular-nums", AMOUNT)}>+{taka(pricing.upgradePrices[u])}</span>
                </span>
                <span className="mt-0.5 block text-sm leading-snug text-muted">{t(`wizard.upgrades.${u}.desc`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Start again */}
      <section className="lc-rv rounded-[32px] bg-[image:var(--gradient-red-dark)] px-6 py-14 text-center text-white sm:px-12 max-[720px]:rounded-[24px]">
        <h2 className="m-0 text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.08] tracking-[-0.035em]">{t("clientHome.final.title")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/75">{t("clientHome.final.body")}</p>
        <ButtonLink href="/start" variant="secondary" size="lg" className="mt-7">
          {t("clientHome.start")} <Arrow />
        </ButtonLink>
      </section>
    </PageShell>
  );
}
