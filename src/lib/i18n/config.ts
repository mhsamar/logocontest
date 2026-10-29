export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The language a page is drawn in: the address's ?lang= first, then the visitor's own choice (the cookie), then Bangla
 * for a visitor from Bangladesh (owner, 2026-10-29: "bangladesh theke kew site a visit korlay bangla language default
 * thakbe, kew chailay change koray nibay"), otherwise English. Search engines crawl from abroad, so they still get the
 * English page at the plain address.
 */
export function pickLocale(input: { url?: string | null; cookie?: string | null; country?: string | null }): Locale {
  if (isLocale(input.url)) return input.url;
  if (isLocale(input.cookie)) return input.cookie;
  return input.country?.toUpperCase() === "BD" ? "bn" : DEFAULT_LOCALE;
}
