import "server-only";
import { contestHref } from "@/lib/client/rules";
import { audit, one } from "@/lib/admin/core";
import { adminIdsWith } from "@/lib/admin/recipients";
import { settleAddonPayment } from "@/lib/contests/addon-payments";
import { announceForPayment } from "@/lib/contests/announce";
import { contestRepository } from "@/lib/contests/services";
import { notify } from "@/lib/notifications";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { settleProPayment } from "@/lib/pro/payments";
import { markContestPromoUsed } from "@/lib/promos/promos";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManual, isTxnId, normalizeMobile, normalizeTxn, type ManualMethod } from "./manual-rules";

/**
 * Manual bKash payments (owner, 2026-10-14). The payer sends money to the bKash personal or merchant number, then
 * gives the transaction ID (and a screenshot if they like) on /pay/{kind}/{id}. An admin checks it in Admin ›
 * Payments › Approvals: approving opens the contest (or adds the add-on, or turns Pro on) exactly like a gateway
 * payment would; rejecting keeps the payment open so they can send the right ID again.
 */

const db = () => createAdminClient();

export const PROOF_BUCKET = "payment-proofs";
export type ManualKind = "contest" | "addon" | "pro";
export const isManualKind = (v: unknown): v is ManualKind => v === "contest" || v === "addon" || v === "pro";

export type Proof = {
  id: string;
  status: "pending" | "approved" | "rejected";
  txnId: string;
  sender: string | null;
  screenshotPath: string | null;
  qaCode: string | null;
  note: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
};

/** One payment as the pay page sees it. */
export type PayTarget = {
  kind: ManualKind;
  paymentId: string;
  userId: string;
  amount: number;
  method: ManualMethod;
  /** "open": waiting for the payer; "paid": approved (or paid another way); "closed": failed or cancelled. */
  state: "open" | "paid" | "closed";
  contest: { id: string; slug: string; brand: string; status: string } | null;
  /** What is being bought: the add-on key, "+N days", or null for a contest or Pro. */
  item: { addon: string | null; days: number | null };
  proof: Proof | null;
};

const toProof = (r: Record<string, unknown>): Proof => ({
  id: r.id as string,
  status: r.status as Proof["status"],
  txnId: r.txn_id as string,
  sender: (r.sender_number as string | null) ?? null,
  screenshotPath: (r.screenshot_path as string | null) ?? null,
  qaCode: (r.qa_code as string | null) ?? null,
  note: (r.note as string | null) ?? null,
  createdAt: new Date(r.created_at as string),
  reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string) : null,
});

const PROOF_COLUMNS = "id, status, txn_id, sender_number, screenshot_path, qa_code, note, created_at, reviewed_at";

async function latestProof(kind: ManualKind, paymentId: string): Promise<Proof | null> {
  const { data } = await db().from("manual_payments").select(PROOF_COLUMNS).eq("kind", kind).eq("payment_id", paymentId).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ? toProof(data[0] as Record<string, unknown>) : null;
}

/** The payment behind /pay/{kind}/{id}, or null when it isn't a manual bKash payment. */
export async function payTarget(kind: ManualKind, paymentId: string): Promise<PayTarget | null> {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  if (kind === "pro") {
    const { data: p } = await db().from("pro_payments").select("id, designer_id, amount_bdt, status, provider").eq("id", paymentId).maybeSingle();
    if (!p || !isManual(p.provider)) return null;
    return {
      kind,
      paymentId,
      userId: p.designer_id as string,
      amount: p.amount_bdt as number,
      method: p.provider,
      state: p.status === "paid" ? "paid" : p.status === "pending" ? "open" : "closed",
      contest: null,
      item: { addon: null, days: null },
      proof: await latestProof(kind, paymentId),
    };
  }
  const { data: p } = await db()
    .from("payments")
    .select("id, client_id, purpose, gateway, amount, status, addon, extension_days, contest:contests!contest_id(id, slug, brand_name, status)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!p || !isManual(p.gateway)) return null;
  if ((kind === "contest") !== (p.purpose === "contest")) return null;
  const c = one(p.contest as { id: string; slug: string; brand_name: string; status: string } | { id: string; slug: string; brand_name: string; status: string }[] | null);
  return {
    kind,
    paymentId,
    userId: p.client_id as string,
    amount: p.amount as number,
    method: p.gateway,
    state: p.status === "paid" ? "paid" : p.status === "initiated" ? "open" : "closed",
    contest: c ? { id: c.id, slug: c.slug, brand: c.brand_name, status: c.status } : null,
    item: { addon: (p.addon as string | null) ?? null, days: (p.extension_days as number | null) ?? null },
    proof: await latestProof(kind, paymentId),
  };
}

/** Contests whose payment is sent and waiting for an admin ("Waiting for approval" on the client's cards): contest → payment. */
export async function awaitingApproval(contestIds: string[]): Promise<Map<string, string>> {
  if (contestIds.length === 0) return new Map();
  const { data } = await db().from("manual_payments").select("contest_id, payment_id").eq("kind", "contest").eq("status", "pending").in("contest_id", contestIds);
  return new Map((data ?? []).map((r) => [r.contest_id as string, r.payment_id as string]));
}

export type SubmitError = "txn" | "sender" | "shot" | "txnUsed" | "already" | "closed" | "generic";

/**
 * The payer's transaction ID (and optional sender number and screenshot). A QA test ID made by an admin is marked
 * on the proof so the admin sees it matched; it still needs their approval like a real one.
 */
export async function submitProof(
  target: PayTarget,
  input: { txnId: string; sender?: string | null; screenshotPath?: string | null },
  payer: { id: string; name: string },
): Promise<{ ok: true; proof: Proof } | { ok: false; error: SubmitError }> {
  if (target.state !== "open") return { ok: false, error: "closed" };
  if (target.proof?.status === "pending") return { ok: false, error: "already" };
  const txn = normalizeTxn(input.txnId ?? "");
  if (!isTxnId(txn)) return { ok: false, error: "txn" };
  const sender = input.sender && input.sender.trim() ? normalizeMobile(input.sender) : null;
  if (input.sender && input.sender.trim() && !sender) return { ok: false, error: "sender" };
  const shot = input.screenshotPath ?? null;
  if (shot && !new RegExp(`^${payer.id}/${target.paymentId}-[0-9a-f-]{36}\\.(png|jpg|webp)$`).test(shot)) return { ok: false, error: "shot" };

  const { data: method } = await db().from("payment_methods").select("account_number").eq("key", target.method).maybeSingle();
  const { data: qa } = await db().from("qa_txn_codes").select("code").eq("code", txn).is("used_at", null).maybeSingle();
  const { data: row, error } = await db()
    .from("manual_payments")
    .insert({
      kind: target.kind,
      payment_id: target.paymentId,
      user_id: payer.id,
      contest_id: target.contest?.id ?? null,
      method: target.method,
      to_number: (method?.account_number as string | null) ?? "",
      amount: target.amount,
      txn_id: txn,
      sender_number: sender,
      screenshot_path: shot,
      qa_code: qa ? txn : null,
    })
    .select(PROOF_COLUMNS)
    .single();
  if (error || !row) {
    if (error?.code === "23505") return { ok: false, error: /txn_once/.test(error.message) ? "txnUsed" : "already" };
    console.error("[manual-pay] proof insert failed:", error?.message);
    return { ok: false, error: "generic" };
  }
  if (qa) await db().from("qa_txn_codes").update({ used_by: row.id, used_at: new Date().toISOString() }).eq("code", txn).is("used_at", null);

  await notifyWithPush([payer.id], "payment_received", { amount: target.amount }, `/pay/${target.kind}/${target.paymentId}`);
  await notify(await adminIdsWith("payments.view"), "payment_submitted_admin", { name: payer.name, amount: target.amount }, "/admin/payments/approvals", payer.id);
  return { ok: true, proof: toProof(row as Record<string, unknown>) };
}

type ProofRow = { id: string; kind: ManualKind; payment_id: string; user_id: string; contest_id: string | null; method: string; amount: number; txn_id: string; status: string; qa_code: string | null };

async function claim(id: string, status: "approved" | "rejected", adminId: string, note: string | null): Promise<ProofRow | null> {
  const { data } = await db()
    .from("manual_payments")
    .update({ status, note, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, kind, payment_id, user_id, contest_id, method, amount, txn_id, status, qa_code")
    .maybeSingle();
  return (data as ProofRow | null) ?? null;
}

const unclaim = (id: string) => db().from("manual_payments").update({ status: "pending", note: null, reviewed_by: null, reviewed_at: null }).eq("id", id);

export type ApproveError = "notPending" | "amount" | "notWaiting" | "generic";

/** Approve: the money arrived. The same steps as a paid gateway callback, then the payer is told. */
export async function approveProof(id: string, adminId: string): Promise<{ ok: true } | { ok: false; error: ApproveError }> {
  const p = await claim(id, "approved", adminId, null);
  if (!p) return { ok: false, error: "notPending" };
  const raw = { manual: "1", method: p.method, txn_id: p.txn_id, proof_id: p.id, ...(p.qa_code ? { qa: "1" } : {}) };
  try {
    if (p.kind === "contest") {
      const { data: pay } = await db().from("payments").select("amount").eq("id", p.payment_id).maybeSingle();
      const contest = await contestRepository().confirmPayment(p.payment_id, (pay?.amount as number) ?? p.amount, p.txn_id, raw);
      await markContestPromoUsed(p.payment_id);
      await announceForPayment(p.payment_id);
      await notifyWithPush([p.user_id], "payment_approved_contest", { brand: contest.brief.brandName }, contestHref(contest.slug));
    } else if (p.kind === "addon") {
      const { data: pay } = await db().from("payments").select("amount").eq("id", p.payment_id).maybeSingle();
      const settled = await settleAddonPayment({ paymentId: p.payment_id, status: "paid", amount: (pay?.amount as number) ?? p.amount, txnId: p.txn_id, raw });
      if (settled.status !== "paid") throw new Error("addon not settled");
      const { data: c } = await db().from("contests").select("brand_name").eq("id", p.contest_id ?? "").maybeSingle();
      await notifyWithPush([p.user_id], "payment_approved_addon", { brand: (c?.brand_name as string) ?? "" }, settled.slug ? contestHref(settled.slug, "payment") : "/client");
    } else {
      const { data: pay } = await db().from("pro_payments").select("amount_bdt").eq("id", p.payment_id).maybeSingle();
      const settled = await settleProPayment({ paymentId: p.payment_id, status: "paid", amount: (pay?.amount_bdt as number) ?? p.amount, txnId: p.txn_id, raw });
      if (settled.status !== "paid") throw new Error("pro not settled");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[manual-pay] approve failed:", msg);
    await unclaim(p.id);
    return { ok: false, error: /amount mismatch/i.test(msg) ? "amount" : /not waiting/i.test(msg) ? "notWaiting" : "generic" };
  }
  await audit(adminId, "payment.approve", "manual_payment", p.id, { kind: p.kind, payment_id: p.payment_id, amount: p.amount, txn_id: p.txn_id, qa: Boolean(p.qa_code) });
  return { ok: true };
}

/** Reject: the money didn't arrive or the ID is wrong. The payment stays open so they can send the right ID. */
export async function rejectProof(id: string, adminId: string, reason: string): Promise<{ ok: true } | { ok: false; error: ApproveError }> {
  const p = await claim(id, "rejected", adminId, reason);
  if (!p) return { ok: false, error: "notPending" };
  await notifyWithPush([p.user_id], "payment_rejected", { amount: p.amount, reason }, `/pay/${p.kind}/${p.payment_id}`);
  await audit(adminId, "payment.reject", "manual_payment", p.id, { kind: p.kind, payment_id: p.payment_id, amount: p.amount, txn_id: p.txn_id, reason });
  return { ok: true };
}
