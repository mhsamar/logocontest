import { Faq, Hero, HowItWorks, Showcase, WhyUs } from "@/components/home/sections";
import { StickyStart } from "@/components/home/sticky-start";
import { getHomeShowcase } from "@/lib/contests/showcase";
import { getI18n } from "@/lib/i18n/server";
import { faqParams } from "@/lib/home/faq-params";

// P-01 Home: hero, recent winning logos, how it works, why us, Q&A (UI-JOURNEY §3).
export default async function HomePage() {
  const { t, locale } = await getI18n();
  const [{ pricing, params }, showcase] = await Promise.all([faqParams(t, locale), getHomeShowcase(12)]);

  return (
    <>
      <Hero standardPrize={pricing.packagePrizes.standard} />
      <Showcase kind={showcase.kind} contests={showcase.contests} />
      <HowItWorks />
      <WhyUs />
      <Faq params={params} />
      <StickyStart label={t("home.sticky")} watchId="hero-end" />
    </>
  );
}
