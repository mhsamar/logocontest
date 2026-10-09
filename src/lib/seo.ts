/** SEO basics (BLUEPRINT §15.1). */

const DEFAULT_SITE_URL = "https://logocontest.bd";

/** The public origin, without a trailing slash: SITE_URL, or the live domain. */
export function siteUrl(): string {
  return (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

/** False on a staging copy (SEO_NOINDEX=true), so search engines skip the whole site. */
export function searchIndexingOn(): boolean {
  return process.env.SEO_NOINDEX !== "true";
}

/** Contests search engines may list: public statuses only, never private or NDA ones. */
export function contestIndexable(c: { status: string; isPrivate: boolean; isNda: boolean }): boolean {
  return ["open", "judging", "winner_selected", "handover", "completed", "no_result"].includes(c.status) && !c.isPrivate && !c.isNda;
}

/** Paths kept out of search engines (robots.txt). */
export const PRIVATE_PATHS = ["/dashboard", "/admin", "/api", "/dev", "/auth", "/notifications", "/start/result", "/verify-email", "/reset-password", "/forgot-password", "/styleguide"];

/** Open Graph for one page. A page that sets openGraph replaces the layout's, so this keeps the shared fields. */
export function openGraphFor(o: { title: string; description?: string; path: string; locale: "en" | "bn"; images?: string[] }) {
  return {
    type: "website" as const,
    siteName: "logocontest.bd",
    locale: o.locale === "bn" ? "bn_BD" : "en_US",
    title: o.title,
    description: o.description,
    url: o.path,
    ...(o.images ? { images: o.images } : {}),
  };
}
