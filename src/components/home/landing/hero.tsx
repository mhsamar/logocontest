/* eslint-disable @next/next/no-img-element */
import { getContact } from "@/lib/content/contact";
import { homeHero } from "@/lib/home/hero";
import { liveDesigners } from "@/lib/home/live-designers";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { HeroForm } from "../hero-form";
import { ShowcaseArt, SlideText } from "./hero-showcase";
import { HeroSlider } from "./hero-slider";
import { LiveDesignersTag } from "./live-designers";

/**
 * P-01 hero: the showcase slider (owner, 2026-10-11; Design/home-hero/HERO-HANDOFF.md). The slides come from
 * Admin → Home hero, or the built-in samples while none is switched on. Left, a showcase picture per slide with the dots; right, the live designers tag, the slide's headline and text, the business-name form (same checks and
 * /start redirect as before) and the "Good to know" chips. The form and chips never change or move.
 */
export async function LandingHero({ nav, picture }: { nav: React.ReactNode; picture: string | null }) {
  const { t, locale } = await getI18n();
  const [contact, hero, live] = await Promise.all([getContact(locale), homeHero(locale, t), liveDesigners()]);

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
              <div className="mt-7 w-full max-w-[540px]">
                <HeroForm />
              </div>
              <div className="lc-hero-row mt-[22px] flex flex-wrap items-center gap-2 text-[15.5px]">
                <strong className="mr-1">{t("home.hero.goodToKnow")}</strong>
                <span className="rounded-lg bg-[var(--lc-chip)] px-3.5 py-1.5 font-semibold">{t("home.hero.pay")}</span>
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
