/**
 * The numbers on the home page's "Simple pricing" cards (owner, 2026-10-29; Design/logocontest-site/index.html). Pure:
 * used by the section and the tests. Every number comes from Admin › Pricing and Settings, never from the design.
 */
import { feePercentFor, prizeWithFee, serviceFee, type PricingConfig } from "@/lib/contests/pricing";
import { limitFor } from "@/lib/logo-check/rules";
import { isManual, type MethodKey } from "@/lib/payments/manual-rules";

type FeeConfig = Pick<PricingConfig, "serviceFeePercent" | "largeFeePercent" | "largeFeeFrom">;

/** The design's three package cards, each with its live prize (the fourth card, Custom, has the visitor's own prize). */
export const PACKAGE_CARDS = ["economy", "standard", "premium"] as const;
export type PackageCardKey = (typeof PACKAGE_CARDS)[number];

export type PackageCard = { key: PackageCardKey; prize: number; feePercent: number; fee: number; total: number; checks: number };

/** One card: the fee at this prize's own rate (the lower one above the threshold) and its free AI logo checks. */
export function cardFor(key: PackageCardKey, prize: number, cfg: FeeConfig, checksPerThousand: number): PackageCard {
  const feePercent = feePercentFor(prize, cfg);
  // Free on every logo contest, N checks for each full ৳1,000 of prize (owner, 2026-10-14).
  return { key, prize, feePercent, fee: serviceFee(prize, feePercent), total: prizeWithFee(prize, cfg), checks: limitFor(prize, false, { perThousand: checksPerThousand, paidChecks: 0 }) };
}

export function packageCards(cfg: FeeConfig & Pick<PricingConfig, "packagePrizes">, checksPerThousand: number): PackageCard[] {
  return PACKAGE_CARDS.map((key) => cardFor(key, cfg.packagePrizes[key], cfg, checksPerThousand));
}

/** The fee rule for the lead and the Custom card: the normal rate, and the large-prize rate when it differs. */
export function feeRule(cfg: FeeConfig): { fee: number; largeFee: number | null; largeFrom: number } {
  return { fee: cfg.serviceFeePercent, largeFee: cfg.largeFeePercent === cfg.serviceFeePercent ? null : cfg.largeFeePercent, largeFrom: cfg.largeFeeFrom };
}

/** Card payments: SSLCommerz in taka, Stripe in US dollars. */
const CARD_METHODS: readonly MethodKey[] = ["sslcommerz", "stripe"];

/**
 * What the open payment methods allow (owner, 2026-10-29: "card" only while a card method is on). `manual`: a bKash
 * number is open, so the client sends the transaction ID and an admin approves the contest. `auto`: a method that
 * puts the contest live by itself (card, bKash checkout, Bangla QR) is open.
 */
export function payKinds(open: readonly MethodKey[]): { bkash: boolean; card: boolean; manual: boolean; auto: boolean } {
  return { bkash: open.some((k) => k.startsWith("bkash")), card: open.some((k) => CARD_METHODS.includes(k)), manual: open.some((k) => isManual(k)), auto: open.some((k) => !isManual(k)) };
}

/** What happens after paying: approved from the transaction ID, live at once, both (by method), or nothing open. */
export function payStep(kinds: { manual: boolean; auto: boolean }): "manual" | "auto" | "mixed" | null {
  if (kinds.manual) return kinds.auto ? "mixed" : "manual";
  return kinds.auto ? "auto" : null;
}

/** Which "Pay with …" wording fits, or null when no bKash or card method is open. */
export function payWording(kinds: { bkash: boolean; card: boolean }): "bkashCard" | "bkash" | "card" | null {
  if (kinds.bkash) return kinds.card ? "bkashCard" : "bkash";
  return kinds.card ? "card" : null;
}
