import type { Locale } from "@/lib/i18n/config";

/**
 * Prices in US dollars for visitors from abroad (owner, 2026-10-14). Pure: used by the server, the pages and the
 * tests. Every amount is kept in taka; dollars are only shown (at the rate in Admin › Settings) and charged by Stripe.
 */

export const CURRENCIES = ["BDT", "USD"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is CurrencyCode => v === "BDT" || v === "USD";

/** The visitor's choice from the footer switch; without it the country decides. */
export const CURRENCY_COOKIE = "lc_currency";

/** How prices show for this visitor: the currency, taka per dollar, and the % added to cover card fees. */
export type Currency = { code: CurrencyCode; rate: number; markup: number };
export const BDT: Currency = { code: "BDT", rate: 122, markup: 0 };

/** Bangladesh (or unknown, as on a local computer) pays in taka; everywhere else sees dollars. */
export const currencyForCountry = (country: string | null | undefined): CurrencyCode => (!country || country.toUpperCase() === "BD" || country.toUpperCase() === "XX" ? "BDT" : "USD");

/**
 * The currency a visitor sees. Bangla pages always show taka (owner, 2026-10-15: "$৪০.৯৮" on a Bangla page looked
 * wrong); on English pages the footer choice wins, else the country decides.
 */
export function currencyFor(input: { locale: Locale; chosen?: string | null; country?: string | null }): CurrencyCode {
  if (input.locale === "bn") return "BDT";
  return isCurrency(input.chosen) ? input.chosen : currencyForCountry(input.country);
}

/** Taka → US cents at the rate, plus the markup. Never below Stripe's 50-cent minimum for a real amount. */
export function toUsdCents(bdt: number, rate: number, markup = 0): number {
  if (!(bdt > 0) || !(rate > 0)) return 0;
  return Math.max(50, Math.round(((bdt / rate) * 100 * (100 + Math.max(0, markup))) / 100));
}

/** $40.98, or $41 when it is whole dollars. In the page's digits (bn: $৪০.৯৮). */
export function formatUsdCents(cents: number, locale: Locale): string {
  const whole = cents % 100 === 0;
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
  return `$${n}`;
}

/** A taka amount as this visitor sees it: ৳6,000, or about $49.18 for a visitor from abroad. */
export function formatPrice(bdt: number, locale: Locale, cur: Currency): string {
  if (cur.code === "USD") return formatUsdCents(bdt > 0 ? toUsdCents(bdt, cur.rate, cur.markup) : 0, locale);
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 0 }).format(bdt);
  return `৳${n}`;
}
