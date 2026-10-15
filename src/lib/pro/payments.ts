import "server-only";
import type { VerifiedCallback } from "@/lib/payments/gateway";
import { createAdminClient } from "@/lib/supabase/admin";
import { callbackMatches } from "./rules";
import { getProSettings } from "./settings";
import { logFunnel, logProActivity, grantPro, sendReceipt, tellDesigner } from "./subscription";
import { markProPromoUsed } from "@/lib/promos/promos";
import { markTrialUpgraded } from "./trial";

const db = () => createAdminClient();

/** True when this gateway payment id is a Pro payment (not a contest or an add-on). */
export async function isProPayment(paymentId: string): Promise<boolean> {
  const { ready } = await getProSettings();
  if (!ready || !/^[0-9a-f-]{36}$/i.test(paymentId)) return false;
  const { data } = await db().from("pro_payments").select("id").eq("id", paymentId).maybeSingle();
  return Boolean(data);
}

/**
 * A verified gateway callback for a Pro payment (the gateway checked the signature before this is called). Paid:
 * the payment is recorded, Pro is turned on or extended by a month, and the receipt is sent. Failed: the payment is
 * marked failed, a renewal shows "Payment failed" on the plan, and no Pro is given. Runs once per payment.
 */
export async function settleProPayment(v: VerifiedCallback): Promise<{ status: "paid" | "failed" | "error"; paymentId: string }> {
  const { data: p } = await db().from("pro_payments").select("id, designer_id, kind, amount_bdt, status, method, receipt_no").eq("id", v.paymentId).maybeSingle();
  if (!p) return { status: "error", paymentId: v.paymentId };
  const match = callbackMatches({ status: p.status as string, amount: p.amount_bdt as number }, v);
  if (match === "already") return { status: p.status === "paid" ? "paid" : "failed", paymentId: v.paymentId };
  if (match === "amount") {
    console.error("[pro] callback amount does not match the payment", v.paymentId);
    return { status: "error", paymentId: v.paymentId };
  }
  const designerId = p.designer_id as string;
  const now = new Date().toISOString();

  if (v.status === "failed") {
    const { data: done } = await db().from("pro_payments").update({ status: "failed", failed_at: now, provider_ref: v.txnId }).eq("id", v.paymentId).eq("status", "pending").select("id");
    if (done?.length) {
      if (p.kind === "renewal") await db().from("pro_subscriptions").update({ status: "payment_failed", updated_at: now }).eq("designer_id", designerId).neq("status", "expired");
      await logFunnel("payment_failed", { designerId, step: p.kind as string });
      await tellDesigner(designerId, "pro_payment_failed", {}, "/pro/checkout");
    }
    return { status: "failed", paymentId: v.paymentId };
  }

  // Claimed first, so two callbacks for the same payment never add two months.
  const { data: claimed } = await db().from("pro_payments").update({ status: "paid", paid_at: now, provider_ref: v.txnId }).eq("id", v.paymentId).eq("status", "pending").select("id");
  if (!claimed?.length) return { status: "paid", paymentId: v.paymentId };
  const sub = await grantPro(designerId, { months: 1, method: (p.method as "bkash" | "card") ?? "bkash", priceBdt: p.amount_bdt as number });
  if (sub) await db().from("pro_payments").update({ subscription_id: sub.id }).eq("id", v.paymentId);
  // Paid during or after the free trial (owner, 2026-10-14): the trial counts as upgraded.
  if (sub) await markTrialUpgraded(designerId, v.paymentId);
  // A Pro discount code on this payment (owner, 2026-10-14) counts as used.
  await markProPromoUsed(v.paymentId);
  await logFunnel(p.kind === "renewal" ? "renewed" : "paid", { designerId, step: p.method as string });
  await logProActivity(null, p.kind === "renewal" ? "renewed" : "paid", designerId, null, { amount: p.amount_bdt, until: sub?.currentPeriodEnd.toISOString() ?? null });
  if (sub) await sendReceipt(designerId, p.receipt_no as number, p.amount_bdt as number, sub.currentPeriodEnd, (p.method as string | null) ?? "bkash");
  return { status: "paid", paymentId: v.paymentId };
}
