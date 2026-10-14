import "server-only";
import { settleAddonPayment } from "@/lib/contests/addon-payments";
import { announceForPayment } from "@/lib/contests/announce";
import { contestRepository } from "@/lib/contests/services";
import { settleProPayment } from "@/lib/pro/payments";
import { markContestPromoUsed } from "@/lib/promos/promos";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeKind, type StripeKind } from "./stripe-api";
import { sessionPaid, type StripeSession } from "./stripe-rules";

/**
 * A Stripe payment is settled (owner, 2026-10-14): from the page the card payer returns to and from Stripe's
 * webhook. Whichever comes first wins; the other finds it done.
 */

const db = () => createAdminClient();

/** The payment behind a session, from our own records (never only from what Stripe sends). */
async function ourPayment(kind: StripeKind, paymentId: string): Promise<{ amount: number; cents: number | null; ref: string | null; provider: string; status: string; slug: string | null; contestId: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  if (kind === "pro") {
    const { data } = await db().from("pro_payments").select("amount_bdt, charged_cents, provider, provider_ref, status").eq("id", paymentId).maybeSingle();
    return data ? { amount: data.amount_bdt as number, cents: (data.charged_cents as number | null) ?? null, ref: (data.provider_ref as string | null) ?? null, provider: data.provider as string, status: data.status as string, slug: null, contestId: null } : null;
  }
  const { data } = await db().from("payments").select("amount, charged_cents, gateway, provider_ref, status, purpose, contest:contests!contest_id(id, slug)").eq("id", paymentId).maybeSingle();
  if (!data || (kind === "contest") !== (data.purpose === "contest")) return null;
  const c = (Array.isArray(data.contest) ? data.contest[0] : data.contest) as { id: string; slug: string } | null;
  return { amount: data.amount as number, cents: (data.charged_cents as number | null) ?? null, ref: (data.provider_ref as string | null) ?? null, provider: data.gateway as string, status: data.status as string, slug: c?.slug ?? null, contestId: c?.id ?? null };
}

export type SettleResult = { kind: StripeKind; paymentId: string; status: "paid" | "failed" | "pending" | "error"; slug: string | null; contestId: string | null };

/**
 * Applies a session to its payment: paid for the exact dollars → the contest opens / the add-on turns on / Pro
 * starts (the same steps as any paid payment); expired or failed → the payment fails. Safe to run more than once.
 */
export async function settleSession(s: StripeSession, opts: { failed?: boolean } = {}): Promise<SettleResult | null> {
  if (!s.paymentId || !isStripeKind(s.kind)) return null;
  const kind = s.kind;
  const p = await ourPayment(kind, s.paymentId);
  const base = { kind, paymentId: s.paymentId, slug: p?.slug ?? null, contestId: p?.contestId ?? null };
  if (!p || p.provider !== "stripe" || p.cents === null) return { ...base, status: "error" };
  // Already settled (the return page and the webhook both come here; a Pro payment then keeps Stripe's payment id).
  if (p.status === "paid") return { ...base, status: "paid" };
  if (p.ref !== s.id) return { ...base, status: "error" };
  const raw = { stripe_session: s.id, stripe_payment_intent: s.paymentIntent ?? "", usd_cents: String(s.amountTotal ?? "") };
  const txn = s.paymentIntent ?? s.id;

  if (sessionPaid(s, p.cents)) {
    try {
      if (kind === "contest") {
        await contestRepository().confirmPayment(s.paymentId, p.amount, txn, raw);
        await markContestPromoUsed(s.paymentId);
        await announceForPayment(s.paymentId);
      } else if (kind === "addon") {
        const r = await settleAddonPayment({ paymentId: s.paymentId, status: "paid", amount: p.amount, txnId: txn, raw });
        if (r.status !== "paid") return { ...base, status: "error" };
      } else {
        const r = await settleProPayment({ paymentId: s.paymentId, status: "paid", amount: p.amount, txnId: txn, raw });
        if (r.status !== "paid") return { ...base, status: "error" };
      }
    } catch (e) {
      console.error("[stripe] settle failed:", e instanceof Error ? e.message : e);
      return { ...base, status: "error" };
    }
    return { ...base, status: "paid" };
  }
  // Expired without paying, or a delayed payment method that failed (webhook).
  if (s.status === "expired" || opts.failed) {
    if (p.status !== "paid") {
      if (kind === "contest") await contestRepository().failPayment(s.paymentId, raw);
      else if (kind === "addon") await settleAddonPayment({ paymentId: s.paymentId, status: "failed", amount: p.amount, txnId: null, raw });
      else await settleProPayment({ paymentId: s.paymentId, status: "failed", amount: p.amount, txnId: null, raw });
    }
    return { ...base, status: "failed" };
  }
  return { ...base, status: p.status === "paid" ? "paid" : "pending" };
}

