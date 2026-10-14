import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { translatorFor } from "@/lib/content/texts";
import { formatPrice } from "@/lib/currency/rules";
import { getCurrency } from "@/lib/currency/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export async function getI18n() {
  const [locale, currency] = await Promise.all([getLocale(), getCurrency()]);
  // `price`: a taka amount in this visitor's currency (owner, 2026-10-14: US dollars for visitors from abroad).
  return { locale, t: await translatorFor(locale), currency, price: (bdt: number) => formatPrice(bdt, locale, currency) };
}
