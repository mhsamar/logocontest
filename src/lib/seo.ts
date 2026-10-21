/** SEO basics (BLUEPRINT §15.1). */

import { localizedPath } from "./i18n/lang-path";

const DEFAULT_SITE_URL = "https://logocontest.bd";

/** The public origin, without a trailing slash: SITE_URL, or the live domain. */
export function siteUrl(): string {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

/** False on a staging copy (SEO_NOINDEX=true), so search engines skip the whole site. */
export function searchIndexingOn(): boolean {
  return process.env.SEO_NOINDEX !== "true";
}

/** Contests search engines may list: public statuses only, never private or NDA ones, nor a test client's. */
export function contestIndexable(c: { status: string; isPrivate: boolean; isNda: boolean; clientIsTest?: boolean }): boolean {
  return ["open", "judging", "winner_selected", "handover", "completed", "no_result"].includes(c.status) && !c.isPrivate && !c.isNda && !c.clientIsTest;
}

/**
 * "Keep this page out of search engines", to spread into a page's metadata (owner, 2026-10-21). An indexable page adds
 * nothing, so the site-wide setting from the layout (SEO_NOINDEX) is never replaced by an empty value.
 */
export function robotsUnless(indexable: boolean): { robots?: { index: false; follow: true } } {
  return indexable ? {} : { robots: { index: false, follow: true } };
}

/** Paths kept out of search engines (robots.txt). */
export const PRIVATE_PATHS = ["/dashboard", "/admin", "/api", "/dev", "/auth", "/notifications", "/support", "/start/result", "/verify-email", "/reset-password", "/forgot-password", "/styleguide"];

/** Open Graph for one page. A page that sets openGraph replaces the layout's, so this keeps the shared fields. */
export function openGraphFor(o: { title: string; description?: string; path?: string; locale: "en" | "bn"; images?: string[] }) {
  return {
    type: "website" as const,
    siteName: "logocontest.bd",
    locale: o.locale === "bn" ? "bn_BD" : "en_US",
    alternateLocale: o.locale === "bn" ? "en_US" : "bn_BD",
    title: o.title,
    description: o.description,
    // The page's own address in its language (owner, 2026-10-21); without a path (the site-wide default) there is
    // none, so a shared page is never described as the home page.
    ...(o.path ? { url: localizedPath(o.path, o.locale) } : {}),
    ...(o.images ? { images: o.images } : {}),
  };
}
