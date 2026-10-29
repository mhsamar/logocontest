import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { translatorFor } from "@/lib/content/texts";
import { formatPrice } from "@/lib/currency/rules";
import { getCurrency } from "@/lib/currency/server";
import { LOCALE_COOKIE, pickLocale, type Locale } from "./config";
import { LOCALE_HEADER, seoAlternates } from "./url";

/** The page's ?lang= (set by the proxy, owner 2026-10-21) wins; otherwise the visitor's cookie; otherwise Bangla from Bangladesh, else English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [h, jar] = await Promise.all([headers(), cookies()]);
  return pickLocale({ url: h.get(LOCALE_HEADER), cookie: jar.get(LOCALE_COOKIE)?.value, country: h.get("x-vercel-ip-country") });
});

export async function getI18n() {
  const [locale, currency] = await Promise.all([getLocale(), getCurrency()]);
  // `price`: a taka amount in this visitor's currency (owner, 2026-10-14: US dollars for visitors from abroad).
  return { locale, t: await translatorFor(locale), currency, price: (bdt: number) => formatPrice(bdt, locale, currency) };
}

/** Canonical and both language versions of a public page, in the language being shown (owner, 2026-10-21). */
export async function pageAlternates(path: string) {
  return seoAlternates(path, await getLocale());
}
