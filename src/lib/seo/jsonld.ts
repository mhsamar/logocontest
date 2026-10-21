import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/lang-path";
import { canonicalOrigin } from "@/lib/site-hosts";

/**
 * Structured data for search engines and AI tools (owner, 2026-10-21; SEO-PLAN.md §2.6). One fixed @id per entity,
 * never per language; the markup only repeats what the page shows. Pure, so it is tested.
 */

export const ORG_ID = () => `${canonicalOrigin()}/#organization`;
export const SITE_ID = () => `${canonicalOrigin()}/#website`;

const url = (path: string, locale: Locale) => `${canonicalOrigin()}${localizedPath(path, locale)}`;

/** Official profiles only: never the Facebook group (it isn't ours to speak for). */
export function sameAsOf(social: Record<string, string | null | undefined>): string[] {
  return Object.entries(social)
    .filter(([k, v]) => k !== "social.facebook_group" && typeof v === "string" && v.startsWith("https://"))
    .map(([, v]) => v as string);
}

export function organization(o: { logo: string; phone: string | null; sameAs: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "OnlineBusiness"],
    "@id": ORG_ID(),
    name: "logocontest.bd",
    alternateName: ["Logo Contest BD", "লোগো কনটেস্ট বিডি"],
    url: canonicalOrigin(),
    logo: o.logo,
    address: { "@type": "PostalAddress", addressCountry: "BD" },
    areaServed: { "@type": "Country", name: "Bangladesh" },
    ...(o.phone ? { contactPoint: { "@type": "ContactPoint", telephone: o.phone, contactType: "customer support", areaServed: "BD", availableLanguage: ["en", "bn"] } } : {}),
    ...(o.sameAs.length ? { sameAs: o.sameAs } : {}),
  };
}

export function website() {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": SITE_ID(), name: "logocontest.bd", alternateName: "Logo Contest BD", url: canonicalOrigin(), inLanguage: ["en", "bn"], publisher: { "@id": ORG_ID() } };
}

/** Home → … → this page, with the addresses in the page's language. */
export function breadcrumbs(items: { name: string; path: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: url(it.path, locale) })),
  };
}

/** The logo design service, with one offer per package at the total a client really pays (prize + fee, in taka). */
export function service(s: { name: string; description: string; path: string; locale: Locale; offers?: { name: string; total: number }[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    description: s.description,
    serviceType: "Logo design",
    url: url(s.path, s.locale),
    provider: { "@id": ORG_ID() },
    areaServed: { "@type": "Country", name: "Bangladesh" },
    // Only prices the page itself shows (its price table).
    ...(s.offers?.length ? { offers: s.offers.map((o) => ({ "@type": "Offer", name: o.name, price: o.total, priceCurrency: "BDT", url: url(s.path, s.locale) })) } : {}),
  };
}

export function faqPage(items: { q: string; a: string }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
  };
}

/** JSON for a <script type="application/ld+json">: "<" escaped so nothing in it can close the tag. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
