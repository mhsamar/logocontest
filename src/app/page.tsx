import type { Metadata } from "next";
import { ClientHome } from "@/components/home/client-home";
import { DesignerHome } from "@/components/home/designer-home";
import { AiChecker } from "@/components/home/landing/ai-checker";
import { AskBand } from "@/components/home/landing/ask-band";
import { DesignerWall } from "@/components/home/landing/designer-wall";
import { LandingFaq } from "@/components/home/landing/faq";
import { LandingHero } from "@/components/home/landing/hero";
import { LandingPricing } from "@/components/home/landing/pricing";
import { Winners } from "@/components/home/landing/winners";
import { SiteNav } from "@/components/layout/site-nav";
import { DesignTypesSection } from "@/components/services/design-types";
import { LiveContests } from "@/components/home/landing/live-contests";
import "@/components/home/landing/landing.css";
import { getCurrentUser } from "@/lib/auth/session";
import { brandPictures } from "@/lib/content/brand";
import { getContact } from "@/lib/content/contact";
import { carouselContests } from "@/lib/home/carousel";
import { faqParams } from "@/lib/home/faq-params";
import { showsLanding } from "@/lib/home/landing";
import { homeWinners } from "@/lib/home/winners";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import { openGraphFor, siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { ldJson, organization, sameAsOf, website } from "@/lib/seo/jsonld";
import { formatTaka } from "@/lib/money";
import { siteFacts } from "@/lib/seo/facts";

// The home page's own address for search engines (QA, 2026-10-18).
export async function generateMetadata(): Promise<Metadata> {
  const [{ t, locale }, facts] = await Promise.all([getI18n(), siteFacts()]);
  // Always in taka with the fee included, whoever is looking (owner, 2026-10-21).
  const description = t("meta.homeDescription", { minTotal: formatTaka(facts.minTotal, locale) });
  return { title: { absolute: t("meta.title") }, description, alternates: await pageAlternates("/"), openGraph: openGraphFor({ title: t("meta.title"), description, path: "/", locale }) };
}

// P-01 Home for visitors (and admins), from the approved design (owner, 2026-10-10; Design/home-page 2026-10-13;
// Design/logocontest-site/index.html 2026-10-29): hero, the live contests carousel, "What if I don't like any of the
// designs?", designers joining, pricing, winners, design types, AI checker, Q&A. The monthly prizes, "why us" with its
// comparison and the two ways in are gone with the new design (owner, 2026-10-29). Every number and contest comes from
// the database.
export default async function HomePage() {
  // One home per role after logging in (owner, 2026-10-08): clients and designers each get their own.
  const user = await getCurrentUser();
  if (user?.role === "client") return <ClientHome user={user} />;
  if (user?.role === "designer") return <DesignerHome user={user} />;
  if (!showsLanding(user?.role)) return null;

  const { t, locale, price } = await getI18n();
  const [{ params }, contests, winners, social, contact, pictures] = await Promise.all([
    faqParams(t, locale, price),
    // Visitors share a light list kept for a minute; admins see it live (owner, 2026-10-28).
    carouselContests(user ?? null),
    homeWinners(12),
    getSettings(["social.facebook", "social.facebook_group", "social.instagram", "social.youtube", "social.linkedin"]),
    getContact(locale),
    brandPictures(),
  ]);
  // Structured data for search engines and AI tools (BLUEPRINT §15.1; owner, 2026-10-21): who we are and the site,
  // with one fixed id each; only our own profiles, never the Facebook group.
  const base = siteUrl();
  const jsonLd = [organization({ logo: `${base}/brand/logo-icon.png`, phone: contact.phone ? `+88${contact.phone}` : null, sameAs: sameAsOf(social) }), website()];

  return (
    <div data-lc-landing className="lc-landing flex flex-1 flex-col gap-3.5 px-3.5 pt-3.5">
      {/* JSON is escaped for "<" so nothing in it can close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      <LandingHero picture={pictures.hero} nav={<SiteNav user={user} />} />
      <LiveContests contests={contests} />
      <AskBand />
      <DesignerWall />
      <LandingPricing />
      <Winners winners={winners} />
      {/* Owner, 2026-10-13 (Design/home-page): "What do you need designed?" replaces "Your new logo in three steps". */}
      <DesignTypesSection />
      {/* Owner, 2026-10-11: the AI copyright checker replaces "Work with designers you can trust". */}
      <AiChecker />
      <LandingFaq params={params} />
    </div>
  );
}
