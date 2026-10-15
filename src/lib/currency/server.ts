import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSettings } from "@/lib/settings";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { BDT, CURRENCY_COOKIE, currencyFor, type Currency } from "./rules";

/**
 * This visitor's currency (owner, 2026-10-14): their footer choice, or else the country Vercel reports for their
 * connection. Bangladesh and unknown countries pay in taka; everyone else sees US dollars and pays with Stripe.
 * Bangla pages always show taka (owner, 2026-10-15).
 */
export const getCurrency = cache(async (): Promise<Currency> => {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const lang = jar.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const code = currencyFor({ locale, chosen: jar.get(CURRENCY_COOKIE)?.value, country: h.get("x-vercel-ip-country") });
  if (code === "BDT") return BDT;
  const s = await getSettings(["payments.usd_rate", "payments.usd_markup_percent"]);
  return { code, rate: s["payments.usd_rate"], markup: s["payments.usd_markup_percent"] };
});
