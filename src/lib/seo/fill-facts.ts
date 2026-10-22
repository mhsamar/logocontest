import type { Locale } from "@/lib/i18n/config";
import { formatNumber, formatTaka } from "@/lib/money";

/** The site's facts for text written for search engines (owner, 2026-10-21); built by siteFacts() in facts.ts. */
export type SiteFacts = {
  minPrize: number;
  minTotal: number;
  fee: number;
  largeFee: number;
  largeFrom: number;
  customStep: number;
  defaultDays: number;
  minDays: number;
  maxDays: number;
  judgingDays: number;
  packages: { key: "economy" | "standard" | "pro" | "premium" | "elite"; prize: number; feePercent: number; total: number }[];
  /** Every add-on is free from this prize (owner, 2026-10-22); 0 = never. */
  addonsFreeFrom: number;
  /** The 3-design guarantee (owner, 2026-10-21): shown only once its claim flow is live. */
  guaranteeOn: boolean;
  guaranteeDesigners: number;
};

/** `{?g:…}` is kept only while the money-back guarantee is offered (`{!g:…}` only while it isn't), `{?a:…}` only while add-ons are
 * free from a prize (`{!a:…}` only while they aren't) (owner, 2026-10-21 / 2026-10-22). */
const SWITCHED_PART = /\{([?!])([a-z]):((?:[^{}]|\{\w+\})*)\}/g;

/** Fills {minTotal}, {fee}, {year}… in a text (see src/lib/landing/types.ts for the list). Unknown names stay as they are. */
export function fillFacts(text: string, f: SiteFacts, locale: Locale, year: number): string {
  const on: Record<string, boolean> = { a: f.addonsFreeFrom > 0, g: f.guaranteeOn };
  const taka = (n: number) => formatTaka(n, locale);
  const num = (n: number) => formatNumber(n, locale);
  const values: Record<string, string> = {
    minPrize: taka(f.minPrize),
    minTotal: taka(f.minTotal),
    fee: num(f.fee),
    largeFee: num(f.largeFee),
    largeFrom: taka(f.largeFrom),
    defaultDays: num(f.defaultDays),
    minDays: num(f.minDays),
    maxDays: num(f.maxDays),
    judgingDays: num(f.judgingDays),
    guaranteeDesigners: num(f.guaranteeDesigners),
    addonsFreeFrom: taka(f.addonsFreeFrom),
    year: locale === "bn" ? new Intl.NumberFormat("bn-BD", { useGrouping: false }).format(year) : String(year),
  };
  return text.replace(SWITCHED_PART, (m, sign: string, flag: string, part: string) => (flag in on ? ((sign === "?") === on[flag] ? part : "") : m)).replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}
