import { Faq, Hero, HowItWorks, Showcase, WhyUs } from "@/components/home/sections";
import { StickyStart } from "@/components/home/sticky-start";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { getHomeShowcase } from "@/lib/contests/showcase";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { getSettings } from "@/lib/settings";

// P-01 Home: hero, recent winning logos, how it works, why us, Q&A (UI-JOURNEY §3).
export default async function HomePage() {
  const [{ t, locale }, pricing, s, showcase] = await Promise.all([
    getI18n(),
    getPricingConfig(),
    getSettings([
      "upgrades.extension_price_per_day",
      "timers.judging_window_days",
      "timers.designer_file_upload_days",
      "timers.client_response_days",
    ]),
    getHomeShowcase(12),
  ]);

  const taka = (n: number) => formatTaka(n, locale);
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const days = pricing.durationOptions.map((d) => num.format(d));
  const durations = days.length > 1 ? `${days.slice(0, -1).join(", ")} ${t("home.faq.or")} ${days.at(-1)}` : days[0];

  // Every number in the answers comes from settings (UI-JOURNEY P-01).
  const faqParams = {
    economy: taka(pricing.packagePrizes.economy),
    standard: taka(pricing.packagePrizes.standard),
    premium: taka(pricing.packagePrizes.premium),
    customMin: taka(pricing.customMin),
    fee: pricing.serviceFeePercent,
    durations,
    perDay: taka(s["upgrades.extension_price_per_day"]),
    judging: s["timers.judging_window_days"],
    upload: s["timers.designer_file_upload_days"],
    response: s["timers.client_response_days"],
    blind: taka(pricing.upgradePrices.blind),
    private: taka(pricing.upgradePrices.private),
  };

  return (
    <>
      <Hero standardPrize={pricing.packagePrizes.standard} />
      <Showcase kind={showcase.kind} contests={showcase.contests} />
      <HowItWorks />
      <WhyUs />
      <Faq params={faqParams} />
      <StickyStart label={t("home.sticky")} watchId="hero-end" />
    </>
  );
}
