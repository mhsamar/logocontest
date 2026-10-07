import type { Locale } from "@/lib/i18n/config";

/** ৳6,000 (en) / ৳৬,০০০ (bn). Amounts are whole taka. */
export function formatTaka(amount: number, locale: Locale): string {
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: 0 }).format(amount);
  return `৳${n}`;
}

/** Plain number in the page's digits: 1,234 (en) / ১,২৩৪ (bn). */
export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN").format(n);
}
