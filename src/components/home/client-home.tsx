import Link from "next/link";
import { UPGRADE_ICONS, UPGRADE_TINT } from "@/components/wizard/upgrade-meta";
import { DELIVERABLES, PACKAGES, UPGRADES } from "@/lib/contests/brief";
import { countRunningContests } from "@/lib/contests/dashboard";
import { prizeWithFee } from "@/lib/contests/pricing";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getSetting } from "@/lib/settings";

const AMOUNT = "text-[#7a4300]";
const CTA =
  "btn-sheen relative inline-flex min-h-12 items-center justify-center gap-2 overflow-clip rounded-full bg-primary px-6 font-semibold text-white shadow-raised transition-[background-color,translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.97]";

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
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      {/* Start here */}
      <section className="relative animate-rise overflow-clip rounded-[2rem] bg-aurora p-6 shadow-frame ring-1 ring-white sm:p-10">
        <span className="pointer-events-none absolute -right-10 -top-12 size-56 animate-float-soft rounded-full bg-[#ffe2a0]/50 blur-2xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-20 left-1/4 size-64 animate-float rounded-full bg-[#ebc9ff]/40 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="text-sm font-semibold text-primary">{t("clientHome.hi", { name: firstName })}</p>
          <h1 className="mt-2 text-h1 font-bold tracking-tight text-ink lg:text-5xl">{t("clientHome.title")}</h1>
          <p className="mt-3 text-lg text-muted">{t("clientHome.lead")}</p>
          <form action="/start" className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              name="name"
              maxLength={60}
              placeholder={t("clientHome.namePlaceholder")}
              aria-label={t("clientHome.namePlaceholder")}
              className="min-h-12 flex-1 rounded-full bg-white/90 px-5 text-base text-ink shadow-card ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-primary"
            />
            <button type="submit" className={CTA}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("clientHome.start")}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Link href="/dashboard" className="font-semibold text-primary hover:underline">
              {t("clientHome.dashboard")} →
            </Link>
            <span className="inline-flex items-center gap-2 text-muted">
              {running > 0 && (
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
              )}
              {running === 0 ? t("clientHome.runningNone") : running === 1 ? t("clientHome.runningOne") : t("clientHome.running", { n: formatNumber(running, locale) })}
            </span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-14">
        <h2 className="text-h2 font-bold text-ink lg:text-h2-lg">{t("clientHome.steps.title")}</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {(["s1", "s2", "s3"] as const).map((k, i) => (
            <li key={k} className="reveal">
              <div className="group h-full rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-raised">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ink to-primary-dark text-white shadow-card transition-[rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {STEP_ICONS[i]}
                    </svg>
                  </span>
                  <span className="font-display text-4xl italic text-primary/25">{formatNumber(i + 1, locale)}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{t(`clientHome.steps.${k}.title`)}</h3>
                <p className="mt-1.5 text-muted">{t(`clientHome.steps.${k}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Packages */}
      <section className="mt-14">
        <h2 className="text-h2 font-bold text-ink lg:text-h2-lg">{t("clientHome.packages.title")}</h2>
        <p className="mt-1 text-muted">{t("clientHome.packages.sub", { fee: pricing.serviceFeePercent, largeFee: pricing.largeFeePercent, largeFrom: taka(pricing.largeFeeFrom) })}</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PACKAGES.map((pkg, i) => {
            const prize = pkg === "custom" ? null : pricing.packagePrizes[pkg];
            return (
              <li key={pkg} className="reveal">
                <Link
                  href="/start"
                  className={cx(
                    "relative flex h-full animate-rise flex-col rounded-2xl bg-surface p-4 shadow-card ring-1 transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-raised",
                    pkg === "standard" ? "ring-2 ring-primary" : pkg === "elite" ? "ring-[#f1c75c]" : "ring-line",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {pkg === "standard" && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{t("wizard.packages.recommended")}</span>
                  )}
                  <span className={cx("text-sm font-semibold", pkg === "elite" ? "text-[#8a5105]" : "text-muted")}>
                    {pkg === "elite" && "👑 "}
                    {t(`wizard.packages.${pkg}.name`)}
                  </span>
                  <span className={cx("mt-1 text-2xl font-extrabold tabular-nums tracking-tight", AMOUNT)}>
                    {prize ? taka(prize) : t("clientHome.packages.customFrom", { min: taka(pricing.customMin) })}
                  </span>
                  <span className="mt-1 text-sm leading-snug text-ink">{t(`wizard.packages.${pkg}.line`)}</span>
                  {prize && <span className="mt-auto pt-2 text-xs text-muted">{t("wizard.packages.youPay", { total: taka(prizeWithFee(prize, pricing)) })}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Length + what's included */}
      <section className="mt-14 grid gap-4 lg:grid-cols-2">
        <div className="reveal rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line">
          <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("clientHome.length.title")}</h2>
          <p className={cx("mt-3 text-4xl font-extrabold tabular-nums tracking-tight", AMOUNT)}>
            {formatNumber(pricing.durationMin, locale)}–{t("wizard.c08.days", { days: formatNumber(pricing.durationMax, locale) })}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="bar-fill h-full w-full rounded-full bg-primary" />
          </div>
          <p className="mt-4 text-muted">{t("clientHome.length.body", { min: formatNumber(pricing.durationMin, locale), max: formatNumber(pricing.durationMax, locale), perDay: taka(perDay) })}</p>
        </div>
        <div className="reveal rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line">
          <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("clientHome.included.title")}</h2>
          <ul className="mt-4 space-y-2.5">
            {[t("wizard.c05.always.main"), t("wizard.c05.always.files"), t("clientHome.included.copyright")].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="text-ink">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm font-semibold text-muted">{t("clientHome.included.extras")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {DELIVERABLES.map((d) => (
              <li key={d} className="rounded-full bg-cream/70 px-3 py-1 text-sm font-medium text-primary-dark">
                {t(`wizard.deliverables.${d}.title`)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Add-ons */}
      <section className="mt-14">
        <h2 className="text-h2 font-bold text-ink lg:text-h2-lg">{t("clientHome.addons.title")}</h2>
        <p className="mt-1 text-muted">{t("clientHome.addons.sub")}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {UPGRADES.map((u) => (
            <li key={u} className="reveal">
              <div className="group flex h-full items-start gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line transition-[box-shadow,translate] duration-300 hover:-translate-y-0.5 hover:shadow-raised">
                <span className={cx("flex size-11 shrink-0 animate-float-soft items-center justify-center rounded-xl bg-gradient-to-br transition-[rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110", UPGRADE_TINT[u])}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {UPGRADE_ICONS[u]}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-ink">{t(`wizard.upgrades.${u}.name`)}</span>
                    <span className={cx("text-sm font-bold tabular-nums", AMOUNT)}>+{taka(pricing.upgradePrices[u])}</span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-muted">{t(`wizard.upgrades.${u}.desc`)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Start again */}
      <section className="reveal mt-14 overflow-clip rounded-[2rem] bg-gradient-to-br from-ink via-[#3a1d14] to-primary-dark p-8 text-center text-white shadow-raised sm:p-12">
        <h2 className="text-h2 font-bold lg:text-h2-lg">{t("clientHome.final.title")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-white/75">{t("clientHome.final.body")}</p>
        <Link href="/start" className="btn-sheen relative mt-6 inline-flex min-h-12 items-center gap-2 overflow-clip rounded-full bg-white px-7 font-semibold text-ink shadow-raised transition-[translate] duration-200 hover:-translate-y-0.5 active:scale-[0.97]">
          {t("clientHome.start")} →
        </Link>
      </section>
    </div>
  );
}
