import { canonicalUrl } from "@/lib/site-hosts";
import type { Locale } from "./config";
import { localizedPath } from "./lang-path";

export { LANG_PARAM, LOCALE_HEADER, langOf, localizedPath, switchHref } from "./lang-path";

/**
 * Canonical and language versions for a public page (hreflang; owner, 2026-10-21): this page's own address in its
 * language, both versions, and English as the default for everyone else.
 */
export function seoAlternates(path: string, locale: Locale) {
  return {
    canonical: canonicalUrl(localizedPath(path, locale)),
    languages: { en: canonicalUrl(localizedPath(path, "en")), bn: canonicalUrl(localizedPath(path, "bn")), "x-default": canonicalUrl(localizedPath(path, "en")) },
  };
}

/**
 * A page only search engines' Bangla version should list (owner, 2026-10-21): the leaderboard is for Bangladesh only,
 * and search engines mostly crawl from abroad, where the English address sends them to the home page.
 */
export function banglaOnlyAlternates(path: string) {
  const bn = canonicalUrl(localizedPath(path, "bn"));
  return { canonical: bn, languages: { bn } };
}
