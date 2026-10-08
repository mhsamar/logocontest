import { Faq, Hero, HowItWorks, Showcase, WhyUs } from "@/components/home/sections";
import { StickyStart } from "@/components/home/sticky-start";
import { TrustedDesigners, TwoWays } from "@/components/home/designers-ways";
import { getHomeShowcase } from "@/lib/contests/showcase";
import { getFeaturedDesigners } from "@/lib/designers/featured";
import { getI18n } from "@/lib/i18n/server";
import { faqParams } from "@/lib/home/faq-params";

// P-01 Home: hero, recent winning logos, how it works, designers you can trust, why us, two ways in, Q&A (UI-JOURNEY P-01).
export default async function HomePage() {
  const { t, locale } = await getI18n();
  const [{ pricing, params }, showcase, designers] = await Promise.all([faqParams(t, locale), getHomeShowcase(12), getFeaturedDesigners(3)]);

  return (
    <>
      <Hero premiumPrize={pricing.packagePrizes.premium} />
      <Showcase kind={showcase.kind} contests={showcase.contests} />
      <HowItWorks />
      <TrustedDesigners designers={designers} />
      <WhyUs />
      <TwoWays />
      <Faq params={params} />
      <StickyStart label={t("home.sticky")} watchId="hero-end" />
    </>
  );
}
