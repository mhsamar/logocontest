import "server-only";
import { headers } from "next/headers";
import { toUsdCents } from "@/lib/currency/rules";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeSecretKey } from "./stripe-config";
import { stripeForm, toSession, type StripeSession } from "./stripe-rules";

/**
 * Stripe Checkout (owner, 2026-10-14): visitors who see prices in US dollars pay by card on Stripe's own page. The
 * secret key and the webhook signing secret live only in the server's environment (STRIPE_SECRET_KEY,
 * STRIPE_WEBHOOK_SECRET). Every amount stays in taka; the dollars charged are kept on the payment and checked
 * when Stripe says it is paid (stripe-settle.ts).
 */

const API = "https://api.stripe.com/v1";
const db = () => createAdminClient();

export type StripeKind = "contest" | "addon" | "pro";
export const isStripeKind = (v: unknown): v is StripeKind => v === "contest" || v === "addon" || v === "pro";

async function call(path: string, init: { method: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string }): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.idempotencyKey ? { "Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error ?? {}) as { message?: string; type?: string };
    // Never the key: only Stripe's own message and type.
    throw new Error(`Stripe ${res.status}: ${err.type ?? "error"} ${err.message ?? ""}`.trim());
  }
  return json;
}

/** Opens a Checkout Session for one payment and returns Stripe's page. */
export async function createStripeCheckout(input: {
  kind: StripeKind;
  paymentId: string;
  cents: number;
  name: string;
  email: string | null;
  origin: string;
  cancelPath: string;
}): Promise<StripeSession> {
  const body = stripeForm({
    mode: "payment",
    client_reference_id: input.paymentId,
    metadata: { payment_id: input.paymentId, kind: input.kind },
    payment_intent_data: { metadata: { payment_id: input.paymentId, kind: input.kind } },
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: input.cents, product_data: { name: input.name.slice(0, 120) } } }],
    // Always US dollars, the price the visitor saw on the site (no "pay in your own currency" choice on Stripe's page).
    adaptive_pricing: { enabled: false },
    customer_email: input.email ?? undefined,
    success_url: `${input.origin}/pay/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}${input.cancelPath}`,
  });
  return toSession(await call("/checkout/sessions", { method: "POST", body, idempotencyKey: `checkout-${input.paymentId}` }));
}

export async function retrieveSession(id: string): Promise<StripeSession | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return null;
  try {
    return toSession(await call(`/checkout/sessions/${id}`, { method: "GET" }));
  } catch (e) {
    console.error("[stripe] session lookup failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Where the visitor came from, for Stripe's return links (the same host they started on). */
async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : (process.env.SITE_URL ?? "").replace(/\/$/, "");
}

/**
 * Opens Stripe for a payment that was just made (in taka): the dollars at today's rate from Admin › Settings are
 * kept on the payment with Stripe's session, then the browser goes to Stripe. Null when Stripe refused.
 */
export async function openStripeCheckout(input: { kind: StripeKind; paymentId: string; bdt: number; name: string; email: string | null; cancelPath: string }): Promise<string | null> {
  const s = await getSettings(["payments.usd_rate", "payments.usd_markup_percent"]);
  const cents = toUsdCents(input.bdt, s["payments.usd_rate"], s["payments.usd_markup_percent"]);
  const table = input.kind === "pro" ? "pro_payments" : "payments";
  try {
    const session = await createStripeCheckout({ kind: input.kind, paymentId: input.paymentId, cents, name: input.name, email: input.email, origin: await requestOrigin(), cancelPath: input.cancelPath });
    if (!session.url) throw new Error("no checkout url");
    const { error } = await db().from(table).update({ currency: "USD", charged_cents: cents, provider_ref: session.id }).eq("id", input.paymentId);
    if (error) throw new Error(error.message);
    return session.url;
  } catch (e) {
    console.error("[stripe] checkout failed:", e instanceof Error ? e.message : e);
    if (input.kind === "pro") await db().from("pro_payments").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", input.paymentId).eq("status", "pending");
    else await db().from("payments").update({ status: "failed" }).eq("id", input.paymentId).eq("status", "initiated");
    return null;
  }
}
