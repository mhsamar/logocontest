import "server-only";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { getProSettings } from "@/lib/pro/settings";
import { getSettings } from "@/lib/settings";

/** Numbers for the Q&A answers on the home and How It Works pages. Every one comes from settings. */
export async function faqParams(t: Translate, locale: Locale, price?: (bdt: number) => string) {
  const [pricing, pro, s] = await Promise.all([
    getPricingConfig(),
    getProSettings(),
    getSettings([
      "upgrades.extension_price_per_day",
      "timers.judging_window_days",
      "timers.designer_file_upload_days",
      "timers.client_response_days",
      "fees.designer_tiers",
      "limits.withdrawal_min",
      "timers.payout_hold_days",
    ]),
  ]);
  // In the visitor's currency on the home and How it works pages (owner, 2026-10-14); legal texts stay in taka.
  const taka = price ?? ((n: number) => formatTaka(n, locale));
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} ${t("home.faq.or")} ${items.at(-1)}` : items[0]);
  const tiers = [...s["fees.designer_tiers"]].sort((a, b) => a.min_wins - b.min_wins);
  const basicLimit = pro.ready && pro.settings.basicEntriesPerContest ? pro.settings.basicEntriesPerContest : 0;

  return {
    pricing,
    params: {
      economy: taka(pricing.packagePrizes.economy),
      standard: taka(pricing.packagePrizes.standard),
      pro: taka(pricing.packagePrizes.pro),
      premium: taka(pricing.packagePrizes.premium),
      elite: taka(pricing.packagePrizes.elite),
      customMin: taka(pricing.customMin),
      fee: pricing.serviceFeePercent,
      largeFee: pricing.largeFeePercent,
      largeFrom: taka(pricing.largeFeeFrom),
      durations: list(pricing.durationOptions.map((d) => num.format(d))),
      minDays: num.format(pricing.durationMin),
      maxDays: num.format(pricing.durationMax),
      perDay: taka(s["upgrades.extension_price_per_day"]),
      judging: s["timers.judging_window_days"],
      upload: s["timers.designer_file_upload_days"],
      response: s["timers.client_response_days"],
      blind: taka(pricing.upgradePrices.blind),
      private: taka(pricing.upgradePrices.private),
      // Designer side
      tierFirst: tiers[0].rate_percent,
      tierLast: tiers.at(-1)!.rate_percent,
      tiers: tiers
        .map((tier, i) => {
          const next = tiers[i + 1];
          const range = next ? `${num.format(tier.min_wins)}–${num.format(next.min_wins - 1)}` : `${num.format(tier.min_wins)}+`;
          return t("howPage.tierLine", { range, rate: tier.rate_percent });
        })
        .join(", "),
      withdrawMin: taka(s["limits.withdrawal_min"]),
      // Days after the client approves until the prize is in the wallet (owner, 2026-10-15).
      hold: num.format(s["timers.payout_hold_days"]),
      // How many designs a designer may send to one contest: Basic is limited, Pro is not (owner, 2026-10-15).
      designsRule: basicLimit ? t("home.faq.designsLimited", { n: num.format(basicLimit) }) : t("home.faq.designsUnlimited"),
      designsShort: basicLimit ? t("home.faq.designsShortLimited", { n: num.format(basicLimit) }) : t("home.faq.designsShortUnlimited"),
      // Every add-on free from a prize (owner, 2026-10-22): one sentence, or nothing while the rule is off.
      addonsFree: (pricing.addonsFreeFrom ?? 0) > 0 ? ` ${t("home.faq.addonsFree", { amount: taka(pricing.addonsFreeFrom!) })}` : "",
    },
  };
}
