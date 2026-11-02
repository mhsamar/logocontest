import { canonicalUrl } from "@/lib/site-hosts";
import type { Locale } from "./config";
import { localizedPath } from "./lang-path";

export { EN_PREFIX, hasBangla, isLocalizedPath, LANG_PARAM, LOCALE_HEADER, langOf, localizedPath, splitLangPath, switchHref } from "./lang-path";

/**
 * Canonical and language versions for a public page (hreflang; owner, 2026-11-03): this page's own address in its
 * language, both versions, and the Bangla (plain) address as the default for everyone else.
 */
export function seoAlternates(path: string, locale: Locale) {
  const bn = canonicalUrl(localizedPath(path, "bn"));
  return {
    canonical: canonicalUrl(localizedPath(path, locale)),
    languages: { bn, en: canonicalUrl(localizedPath(path, "en")), "x-default": bn },
  };
}

/**
 * A page whose own text is English only (a contest brief written in English, a guide not yet in Bangla): both
 * addresses point to the English one, and no Bangla version is offered.
 */
export function englishOnlyAlternates(path: string) {
  const en = canonicalUrl(localizedPath(path, "en"));
  return { canonical: en, languages: { en, "x-default": en } };
}

/** A page with no English version (the leaderboard is for Bangladesh only): Bangla alone, no hreflang="en". */
export function banglaOnlyAlternates(path: string) {
  const bn = canonicalUrl(localizedPath(path, "bn"));
  return { canonical: bn, languages: { bn, "x-default": bn } };
}
