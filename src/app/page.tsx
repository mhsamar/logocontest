import { ClientHome } from "@/components/home/client-home";
import { DesignerHome } from "@/components/home/designer-home";
import { LandingFaq } from "@/components/home/landing/faq";
import { LandingHero } from "@/components/home/landing/hero";
import { SiteNav } from "@/components/layout/site-nav";
import { Join } from "@/components/home/landing/join";
import { LiveContests } from "@/components/home/landing/live-contests";
import { Steps } from "@/components/home/landing/steps";
import { Trusted } from "@/components/home/landing/trusted";
import { Why } from "@/components/home/landing/why";
import "@/components/home/landing/landing.css";
import { getCurrentUser } from "@/lib/auth/session";
import { brandPictures } from "@/lib/content/brand";
import { getContact } from "@/lib/content/contact";
import { liveContests } from "@/lib/contests/browse";
import { faqParams } from "@/lib/home/faq-params";
import { showsLanding } from "@/lib/home/landing";
import { homeLogos } from "@/lib/home/logos";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

// P-01 Home for visitors (and admins), from the approved design (owner, 2026-10-10;
// Design/logocontest-home-design.html): hero, live contests, three steps, designers you can trust,
// why us + comparison, two ways in, Q&A. Every number and contest comes from the database.
export default async function HomePage() {
  // One home per role after logging in (owner, 2026-10-08): clients and designers each get their own.
  const user = await getCurrentUser();
  if (user?.role === "client") return <ClientHome user={user} />;
  if (user?.role === "designer") return <DesignerHome user={user} />;
  if (!showsLanding(user?.role)) return null;

  const { t, locale } = await getI18n();
  const [{ pricing, params }, contests, logos, social, contact, pictures] = await Promise.all([
    faqParams(t, locale),
    liveContests(3),
    homeLogos(12),
    getSettings(["social.facebook", "social.facebook_group", "social.instagram", "social.youtube", "social.linkedin"]),
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
      <LandingHero logos={logos} premiumPrize={pricing.packagePrizes.premium} picture={pictures.hero} nav={<SiteNav user={user} />} />
      <LiveContests contests={contests} />
      <Steps logos={logos} />
      <Trusted logos={logos} />
      <Why logos={logos} />
      <Join />
      <LandingFaq params={params} />
    </div>
  );
}
