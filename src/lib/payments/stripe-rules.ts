import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe (owner, 2026-10-14): card payments in US dollars for visitors from abroad. Pure parts: the webhook
 * signature check and the form body the Stripe API takes. No Stripe library is needed for these two calls.
 */

/** Checks a `Stripe-Signature` header (t=…,v1=…) against the raw body; older than `toleranceSec` is refused. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSec: number, toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(t) || sigs.length === 0 || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex"), "utf8");
  return sigs.some((s) => {
    const got = Buffer.from(s, "utf8");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** Nested values as Stripe's form encoding: line_items[0][price_data][currency]=usd. */
export function stripeForm(params: Record<string, unknown>, prefix = ""): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, key ? `${key}[${k}]` : k);
    else out.append(key, String(v));
  };
  walk(params, prefix);
  return out;
}

/** What a Checkout Session tells us. */
export type StripeSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired" | string;
  paymentStatus: "paid" | "unpaid" | "no_payment_required" | string;
  amountTotal: number | null;
  currency: string | null;
  paymentIntent: string | null;
  paymentId: string | null;
  kind: string | null;
};

export function toSession(raw: Record<string, unknown>): StripeSession {
  const meta = (raw.metadata ?? {}) as Record<string, string>;
  const pi = raw.payment_intent;
  // If Stripe let the payer pick their own currency, the amount we asked for (dollars) is in currency_conversion.
  const conv = (raw.currency_conversion ?? null) as { source_currency?: string; amount_total?: number } | null;
  const fromConv = conv && typeof conv.amount_total === "number" && conv.source_currency;
  return {
    id: String(raw.id ?? ""),
    url: (raw.url as string | null) ?? null,
    status: String(raw.status ?? ""),
    paymentStatus: String(raw.payment_status ?? ""),
    amountTotal: fromConv ? conv!.amount_total! : typeof raw.amount_total === "number" ? raw.amount_total : null,
    currency: fromConv ? conv!.source_currency! : ((raw.currency as string | null) ?? null),
    paymentIntent: typeof pi === "string" ? pi : pi && typeof pi === "object" ? String((pi as { id?: string }).id ?? "") || null : null,
    paymentId: meta.payment_id ?? (raw.client_reference_id as string | null) ?? null,
    kind: meta.kind ?? null,
  };
}

/** Is this session's money in, for exactly the dollars we asked for? */
export const sessionPaid = (s: StripeSession, cents: number) => s.paymentStatus === "paid" && s.currency === "usd" && s.amountTotal === cents;
