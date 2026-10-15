/**
 * Payment methods and manual bKash (owner, 2026-10-14). Pure: used by the server, the pages and the tests.
 * bKash Personal and bKash Merchant are manual (send money, give the transaction ID, an admin approves); the bKash
 * API and SSLCommerz are automatic gateways, switched on once they are set up. Stripe takes cards in US dollars
 * from visitors abroad; the others are for visitors who see taka.
 */

// Bangla QR (owner, 2026-10-15): automatic, for later, once Bangladesh Bank's API is out (see bangla-qr.ts).
export const METHOD_KEYS = ["bkash_personal", "bkash_merchant", "bkash_api", "sslcommerz", "bangla_qr", "stripe"] as const;
export type MethodKey = (typeof METHOD_KEYS)[number];
export const isMethodKey = (v: unknown): v is MethodKey => (METHOD_KEYS as readonly unknown[]).includes(v);

export const MANUAL_METHODS = ["bkash_personal", "bkash_merchant"] as const;
export type ManualMethod = (typeof MANUAL_METHODS)[number];
export const isManual = (v: unknown): v is ManualMethod => (MANUAL_METHODS as readonly unknown[]).includes(v);

/** The automatic gateway's own method name for this key (the gateway API speaks "bkash" and "card"). */
export const gatewayMethod = (key: Exclude<MethodKey, ManualMethod>): "bkash" | "card" => (key === "bkash_api" ? "bkash" : "card");

/** Stripe is the US dollar method; every other method takes taka. */
export const methodCurrency = (key: MethodKey): "BDT" | "USD" => (key === "stripe" ? "USD" : "BDT");

/** Older pages sent "bkash" or "card": the automatic gateway for each. */
export const legacyMethod = (v: string): string => (v === "bkash" ? "bkash_api" : v === "card" ? "sslcommerz" : v);

/** What the pay buttons show: the method, and for manual ones the number to send to. */
export type PublicMethod = { key: MethodKey; manual: boolean; number: string | null; name: string | null; note: string | null };

/** bKash transaction IDs are 10 letters and digits; a little room either way. Spaces and lower case are fixed. */
export const normalizeTxn = (v: string) => v.replace(/[\s-]+/g, "").toUpperCase();
export const isTxnId = (v: string) => /^[A-Z0-9]{8,14}$/.test(v);

/** Bangladesh mobile numbers: 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX. */
export function normalizeMobile(v: string): string | null {
  const d = v.replace(/[\s()-]+/g, "");
  if (/^01[3-9][0-9]{8}$/.test(d)) return `+88${d}`;
  if (/^8801[3-9][0-9]{8}$/.test(d)) return `+${d}`;
  if (/^\+8801[3-9][0-9]{8}$/.test(d)) return d;
  return null;
}

/** "+8801677713493" → "01677-713493", easy to type into the bKash app. */
export function showMobile(v: string | null | undefined): string {
  if (!v) return "";
  const d = v.replace(/^\+?88/, "");
  return /^01[0-9]{9}$/.test(d) ? `${d.slice(0, 5)}-${d.slice(5)}` : v;
}

/** QA transaction IDs: 10 letters and digits, starting with QA so nobody mixes them up with real ones. */
export const QA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function qaCodeFrom(bytes: Uint8Array): string {
  if (bytes.length < 8) throw new Error("8 bytes needed");
  return `QA${Array.from(bytes.slice(0, 8), (b) => QA_ALPHABET[b % 32]).join("")}`;
}

// ---------------------------------------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------------------------------------

export type PromoKind = "client_fee" | "designer_fee" | "pro_discount";
/** The fee a client code can set (owner, 2026-10-14: 25% down to 20, 15, 10, 5 or 0). */
export const CLIENT_FEE_CHOICES = [20, 15, 10, 5, 0] as const;
/** The fee a designer code can set on their next win (owner: 15% down to 10, 5 or 0; 15 is the starting fee). */
export const DESIGNER_FEE_CHOICES = [15, 10, 5, 0] as const;

export const PROMO_CODE = /^[A-Z0-9-]{4,24}$/;
export const normalizePromo = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");

/** A fee code never raises the fee: the lower of the normal fee and the code's fee. */
export const feeWithCode = (normalPercent: number, codePercent: number) => Math.min(normalPercent, codePercent);

/** A client's contest with a fee code: the fee and the total at the code's percent. */
export function contestAmountsWithFee(a: { prize: number; upgrades: number }, feePercent: number) {
  const serviceFee = Math.round((a.prize * feePercent) / 100);
  return { serviceFee, total: a.prize + serviceFee + a.upgrades };
}

/** Pro with a discount code: the price after `percent` % off, whole taka, never below zero. */
export const proPriceWithCode = (price: number, percent: number) => Math.max(0, Math.round((price * (100 - Math.min(100, Math.max(0, percent)))) / 100));

/** Random one-time codes: 8 characters after an optional prefix, from letters and digits that can't be mixed up. */
export function randomPromoCode(bytes: Uint8Array, prefix = ""): string {
  if (bytes.length < 8) throw new Error("8 bytes needed");
  const body = Array.from(bytes.slice(0, 8), (b) => QA_ALPHABET[b % 32]).join("");
  const p = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
  return p ? `${p}-${body}` : body;
}
