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

/** A language switch link: the same page with ?lang= set either way, so the choice sticks. */
export function switchHref(pathname: string, search: string, locale: Locale): string {
  const params = new URLSearchParams(search);
  params.set(LANG_PARAM, locale);
  return `${pathname || "/"}?${params.toString()}`;
}
