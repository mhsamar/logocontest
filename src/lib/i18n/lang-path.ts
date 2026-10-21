import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * Each language has its own address (owner, 2026-10-21: search engines don't keep cookies, so before this only the
 * English pages could ever be found). English is the plain address, Bangla the same address with ?lang=bn. Opening
 * either sets the visitor's language (the proxy reads it); without it the cookie decides, as before. No imports of
 * site code here, so SEO, currency and the proxy can all use it.
 */
export const LANG_PARAM = "lang";
/** Set by the proxy from ?lang= for this one request, read by getLocale (and getCurrency) before the cookie. */
export const LOCALE_HEADER = "x-lc-locale";

/** The language a URL asks for, if any. */
export function langOf(search: string | URLSearchParams): Locale | null {
  const v = (typeof search === "string" ? new URLSearchParams(search) : search).get(LANG_PARAM);
  return isLocale(v) ? v : null;
}

/** `path` (which may have its own query) in a language: English without ?lang, Bangla with ?lang=bn. */
export function localizedPath(path: string, locale: Locale): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete(LANG_PARAM);
  if (locale !== DEFAULT_LOCALE) params.set(LANG_PARAM, locale);
  const q = params.toString();
  return `${base || "/"}${q ? `?${q}` : ""}`;
}

/**
 * Whether people's own text is written in Bangla (owner, 2026-10-21): at least about 30% of its letters are Bengali
 * script. A contest brief in English makes the Bangla address of its page mostly the same text, so that page is only
 * offered to search engines in English.
 */
export function hasBangla(text: string | null | undefined): boolean {
  // Bengali vowel signs and the hasanta are marks, not letters, so both count.
  const letters = (text ?? "").match(/[\p{L}\p{M}]/gu) ?? [];
  if (letters.length < 8) return false;
  const bangla = letters.filter((ch) => /[\u0980-\u09FF]/.test(ch)).length;
  return bangla / letters.length >= 0.3;
}

/** A language switch link: the same page with ?lang= set either way, so the choice sticks. */
export function switchHref(pathname: string, search: string, locale: Locale): string {
  const params = new URLSearchParams(search);
  params.set(LANG_PARAM, locale);
  return `${pathname || "/"}?${params.toString()}`;
}
