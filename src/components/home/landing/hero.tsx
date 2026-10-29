/* eslint-disable @next/next/no-img-element */
import { getContact } from "@/lib/content/contact";
import { homeHero } from "@/lib/home/hero";
import { homePayMethods } from "@/lib/home/pay-methods";
import { payKinds, payWording } from "@/lib/home/pricing-cards";
import { liveDesigners } from "@/lib/home/live-designers";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import Link from "@/components/ui/link";
import { ShowcaseArt, SlideText } from "./hero-showcase";
import { HeroSlider } from "./hero-slider";
import { LiveDesignersTag } from "./live-designers";

/**
 * P-01 hero: the showcase slider (owner, 2026-10-11; Design/home-hero/HERO-HANDOFF.md). The slides come from
 * Admin → Home hero, or the built-in samples while none is switched on. Left, a showcase picture per slide with the dots; right, the live designers tag, the slide's headline and text, the "Select your contest type"
 * button (owner, 2026-10-13: in place of the business-name form; it opens the category picker) and the "Good to know" chips. The button and chips never change or move.
 */
export async function LandingHero({ nav, picture }: { nav: React.ReactNode; picture: string | null }) {
  const { t, locale, currency } = await getI18n();
  const [contact, hero, live, methods] = await Promise.all([getContact(locale), homeHero(locale, t), liveDesigners(), homePayMethods(currency.code).catch(() => [])]);
  // "bKash or card" only while a card method is on (owner, 2026-10-29); by card alone for a visitor paying in dollars.
  const pay = payWording(payKinds(methods));

  return (
    <header className="lc-hero relative isolate z-10 flex flex-col items-center overflow-hidden rounded-[32px] bg-white px-6 pb-16 pt-[128px] sm:px-10">
      {nav}

      <HeroSlider
        intervalMs={hero.intervalMs}
        showcases={hero.slides.map((s, i) => (
          <ShowcaseArt key={s.key} slide={s} first={i === 0} t={t} />
        ))}
        texts={hero.slides.map((s, i) => (
          <SlideText key={s.key} slide={s} first={i === 0} />
        ))}
        labels={hero.slides.map((s) => t("home.hero.brandLabel", { brand: s.brand }))}
        dotLabel={Array.from({ length: hero.slides.length }, (_, i) => t("home.hero.dot", { n: formatNumber(i + 1, locale) }))}
        sampleLabel={hero.sample ? t("home.hero.sample") : null}
        aside={{
          // The live designers tag (owner, 2026-10-11) in place of the "Logo contests · Bangladesh" pill.
          top: <LiveDesignersTag initial={live} />,
          bottom: (
            <>
              {/* Owner, 2026-10-13: with contest categories, one button to choose the type (the business-name box is gone). */}
              <div className="mt-7 w-full max-w-[540px]">
                <Link href="/start" className="lc-type-cta group">
                  <span className="lc-type-ico" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
                      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
                      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
                      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
                    </svg>
                  </span>
                  <span className="lc-type-label">{t("home.hero.chooseType")}</span>
                  <span className="lc-type-go" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              </div>
              <div className="lc-hero-row mt-[22px] flex flex-wrap items-center gap-2 text-[15.5px]">
                <strong className="mr-1">{t("home.hero.goodToKnow")}</strong>
                {/* No chip while no bKash or card method is open in this visitor's currency (review, 2026-10-29). */}
                {pay && <span className="rounded-lg bg-[var(--lc-chip)] px-3.5 py-1.5 font-semibold">{t(pay === "bkashCard" ? "home.hero.payCard" : pay === "card" ? "home.hero.payCardOnly" : "home.hero.pay")}</span>}
                <span className="rounded-lg bg-[var(--lc-chip)] px-3.5 py-1.5 font-semibold">{t("home.hero.held")}</span>
                <a href={contact.phoneHref} className="rounded-lg bg-[var(--lc-chip)] px-3.5 py-1.5 font-semibold">
                  {t("home.hero.call", { phone: contact.phone })}
                </a>
              </div>
            </>
          ),
        }}
      />

      {/* An admin's own home picture (Brand & notice, A-17), under the slider (owner, 2026-10-11: kept). */}
      {picture && <img src={picture} alt="" className="lc-sh mt-10 block w-full max-w-5xl rounded-[28px] object-cover" />}
    </header>
  );
}
