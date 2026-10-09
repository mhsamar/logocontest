import { Faq, Hero, HowItWorks, Showcase, WhyUs } from "@/components/home/sections";
import { ClientHome } from "@/components/home/client-home";
import { DesignerHome } from "@/components/home/designer-home";
import { StickyStart } from "@/components/home/sticky-start";
import { TrustedDesigners, TwoWays } from "@/components/home/designers-ways";
import { getHomeShowcase } from "@/lib/contests/showcase";
import { getFeaturedDesigners } from "@/lib/designers/featured";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { faqParams } from "@/lib/home/faq-params";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { getContact } from "@/lib/content/contact";

// P-01 Home for visitors (and admins): hero, recent winning logos, how it works, designers you can trust, why us, two ways in, Q&A (UI-JOURNEY P-01).
export default async function HomePage() {
  // One home per role after logging in (owner, 2026-10-08): clients and designers each get their own.
  const user = await getCurrentUser();
  if (user?.role === "client") return <ClientHome user={user} />;
  if (user?.role === "designer") return <DesignerHome user={user} />;

  const { t, locale } = await getI18n();
  const [{ pricing, params }, showcase, designers, social] = await Promise.all([
    faqParams(t, locale),
    getHomeShowcase(12),
    getFeaturedDesigners(3),
    getSettings(["social.facebook", "social.facebook_group", "social.instagram", "social.youtube", "social.linkedin"]),
  ]);
  // Structured data for search engines (BLUEPRINT §15.1): who we are and the site itself.
  const base = siteUrl();
  const contact = await getContact(locale);
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
    <>
      {/* JSON is escaped for "<" so nothing in it can close the script tag. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
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
