import type { Metadata } from "next";
import { ClientHome } from "@/components/home/client-home";
import { DesignerHome } from "@/components/home/designer-home";
import { AiChecker } from "@/components/home/landing/ai-checker";
import { LandingFaq } from "@/components/home/landing/faq";
import { LandingHero } from "@/components/home/landing/hero";
import { SiteNav } from "@/components/layout/site-nav";
import { DesignTypesSection } from "@/components/services/design-types";
import { Join } from "@/components/home/landing/join";
import { HeroOffer } from "@/components/home/landing/hero-offer";
import { LiveContests } from "@/components/home/landing/live-contests";
import { Why } from "@/components/home/landing/why";
import "@/components/home/landing/landing.css";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { brandPictures } from "@/lib/content/brand";
import { getContact } from "@/lib/content/contact";
import { liveContests } from "@/lib/contests/browse";
import { faqParams } from "@/lib/home/faq-params";
import { showsLanding } from "@/lib/home/landing";
import { homeLogos } from "@/lib/home/logos";
import { getI18n } from "@/lib/i18n/server";
import { earlyCutoff } from "@/lib/pro/limits";
import { visibleOffers } from "@/lib/rewards/visible";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { canonicalUrl } from "@/lib/site-hosts";

// The home page's own address for search engines (QA, 2026-10-18).
export const metadata: Metadata = { alternates: { canonical: canonicalUrl("/") } };

// P-01 Home for visitors (and admins), from the approved design (owner, 2026-10-10;
// Design/logocontest-home-design.html; Design/home-page 2026-10-13): hero, live contests, design types, AI checker,
// why us + comparison, two ways in, Q&A. Every number and contest comes from the database.
export default async function HomePage() {
  // One home per role after logging in (owner, 2026-10-08): clients and designers each get their own.
  const user = await getCurrentUser();
  if (user?.role === "client") return <ClientHome user={user} />;
  if (user?.role === "designer") return <DesignerHome user={user} />;
  if (!showsLanding(user?.role)) return null;

  const { t, locale, price } = await getI18n();
  const [{ params }, contests, logos, social, prizes, offers, contact, pictures] = await Promise.all([
    faqParams(t, locale, price),
    earlyCutoff(user ?? null).then((cut) => liveContests(3, cut)),
    homeLogos(12),
    getSettings(["social.facebook", "social.facebook_group", "social.instagram", "social.youtube", "social.linkedin"]),
    getSettings(["home.hero_offer_slide"]),
    visibleOffers(),
    getContact(locale),
    brandPictures(),
  ]);
  // Structured data for search engines (BLUEPRINT §15.1): who we are and the site itself.
  const base = siteUrl();
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "logocontest.bd",
      url: base,
      logo: `${base}/brand/logo-icon.png`,
      contactPoint: { "@type": "ContactPoint", telephone: "+88" + contact.phone, contactType: "customer support", areaServed: "BD", availableLanguage: ["en", "bn"] },
      sameAs: Object.values(social).filter(Boolean),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "logocontest.bd", url: base, inLanguage: ["en", "bn"] },
  ];

  return (
    <div data-lc-landing className="lc-landing flex flex-1 flex-col gap-3.5 px-3.5 pt-3.5">
      {/* JSON is escaped for "<" so nothing in it can close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <LandingHero picture={pictures.hero} nav={<SiteNav user={user} />} />
      <LiveContests contests={contests} />
      {/* Owner, 2026-10-11: the two monthly prizes (Design/rewards/home-hero-offer-slide.html) as their own section under the
          live contests, not in the hero. On/off in Admin → Home hero. */}
      {prizes["home.hero_offer_slide"] && (offers.smartphone || offers.giftBox) && (
        <section aria-label={t("home.offer.section")} className="lc-prizes rounded-[32px] bg-white px-6 py-10 sm:px-10">
          <div className={cx("lc-prizes-grid mx-auto max-w-[1240px]", !(offers.smartphone && offers.giftBox) && "lc-prizes-one")}>
            <HeroOffer t={t} smartphone={offers.smartphone} giftBox={offers.giftBox} />
          </div>
        </section>
      )}
      {/* Owner, 2026-10-13 (Design/home-page): "What do you need designed?" replaces "Your new logo in three steps". */}
      <DesignTypesSection />
      {/* Owner, 2026-10-11: the AI copyright checker replaces "Work with designers you can trust". */}
      <AiChecker />
      <Why logos={logos} />
      <Join />
      <LandingFaq params={params} />
    </div>
  );
}
