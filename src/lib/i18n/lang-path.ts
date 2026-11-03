import { isLocale, type Locale } from "./config";

/**
 * Each language has its own address (owner, 2026-11-03, replacing ?lang=bn from 2026-10-21): Bangla is the plain
 * address (https://logocontest.bd/how-it-works) and English lives under /en (https://logocontest.bd/en/how-it-works).
 * The proxy serves /en/… from the same page in English. An old ?lang= address is sent on to the clean one. Pages
 * outside the public site (sign-in, the wizard, the workspaces) have no /en address: there the cookie decides, and a
 * link may still carry ?lang= to set it. No imports of site code here, so SEO, currency and the proxy can all use it.
 */
export const LANG_PARAM = "lang";
/** Set by the proxy from the address (/en or not) for this one request, read by getLocale (and getCurrency) before the cookie. */
export const LOCALE_HEADER = "x-lc-locale";
/** The English address prefix. */
export const EN_PREFIX = "/en";

/** The public pages, which have a Bangla and an English address (each with its own canonical and hreflang). */
const LOCALIZED =
  /^\/(?:|contests|contest\/[^/]+|contest\/[^/]+\/design\/\d+|design-studio|designers\/signup|guides|guides\/[^/]+|help|how-it-works|legal\/[^/]+|logo-checker|logo-design|logo-design\/[^/]+|logo-design-price|about|pro|winners|leaderboard|d\/[^/]+|designer\/[^/]+|c\/[^/]+)\/?$/;

export const isLocalizedPath = (pathname: string) => LOCALIZED.test(pathname);

/** "/en/how-it-works" → { locale: "en", path: "/how-it-works" }; "/how-it-works" → { locale: null, path: "/how-it-works" }. */
export function splitLangPath(pathname: string): { locale: Locale | null; path: string } {
  if (pathname === EN_PREFIX || pathname === `${EN_PREFIX}/`) return { locale: "en", path: "/" };
  if (pathname.startsWith(`${EN_PREFIX}/`)) return { locale: "en", path: pathname.slice(EN_PREFIX.length) };
  return { locale: null, path: pathname || "/" };
}

/** The language a URL asks for, if any. */
export function langOf(search: string | URLSearchParams): Locale | null {
  const v = (typeof search === "string" ? new URLSearchParams(search) : search).get(LANG_PARAM);
  return isLocale(v) ? v : null;
}

/**
 * `path` (which may have its own query) in a language. A public page: Bangla plain, English under /en. Any other page
 * has one address, with ?lang=bn for Bangla so a link (an email) opens in the right language.
 */
export function localizedPath(path: string, locale: Locale): string {
  const [raw, query = ""] = path.split("?");
  const base = splitLangPath(raw || "/").path;
  const params = new URLSearchParams(query);
  params.delete(LANG_PARAM);
  const localized = isLocalizedPath(base);
  if (!localized && locale === "bn") params.set(LANG_PARAM, locale);
  const q = params.toString();
  const pathname = localized && locale === "en" ? (base === "/" ? EN_PREFIX : `${EN_PREFIX}${base}`) : base;
  return `${pathname}${q ? `?${q}` : ""}`;
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

/** A language switch link: the same page and settings in the other language (on a page without /en, with ?lang=). */
export function switchHref(pathname: string, search: string, locale: Locale): string {
  const params = new URLSearchParams(search);
  params.delete(LANG_PARAM);
  const base = splitLangPath(pathname || "/").path;
  const q = params.toString();
  const path = `${base}${q ? `?${q}` : ""}`;
  if (isLocalizedPath(base)) return localizedPath(path, locale);
  params.set(LANG_PARAM, locale);
  return `${base}?${params.toString()}`;
}
