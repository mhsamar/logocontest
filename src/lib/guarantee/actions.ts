"use server";

import { refresh } from "next/cache";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { normalizeBdMobile } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { tellClient, tellTeam } from "./notices";
import { claimForAction, contestGuarantee, countedNow } from "./queries";
import { CHECK_NOTE_MIN, CLAIM_NOTE_MAX, claimErrorOf, cleanExclusions, cleanRefundRef, INTERNAL_MAX, REPLY_MAX, REPLY_MIN, refundRoutes, refundsComplete, routeAmounts, type ClaimError, type PaidLine } from "./rules";

/** Money-back guarantee (owner, 2026-10-21; BLUEPRINT §7.10): the client's claim and the team's decision and refund. */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey) => ({ ok: false as const, error });
const db = () => createAdminClient();
const errorKey = (e: ClaimError | null): MessageKey => (e ? (`guarantee.errors.${e}` as MessageKey) : "auth.errors.generic");
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The client asks for their money back (or, with enough designers counted, asks the team to check the count). */
export async function claimGuarantee(input: { contestId: string; refundTo?: string; note?: string; check?: boolean; agree?: boolean }): Promise<Result> {
  if (!isSupabaseConfigured() || !UUID.test(input.contestId)) return fail("auth.errors.generic");
  const user = await getCurrentUser();
  const { data: c } = await db().from("contests").select("id, slug, brand_name, client_id").eq("id", input.contestId).maybeSingle();
  if (!c || !can(user, "guarantee.claim", { contestOwnerId: c.client_id as string })) return fail("auth.errors.generic");
  if (!input.agree) return fail("guarantee.errors.agree");
  const g = await contestGuarantee(c.id as string);
  if (g.state.kind !== "available" && g.state.kind !== "check") return fail(g.state.kind === "claimed" ? "guarantee.errors.already" : "guarantee.errors.closed");
  const check = g.state.kind === "check";
  const note = clean(input.note, CLAIM_NOTE_MAX);
  if (check && note.length < CHECK_NOTE_MIN) return fail("guarantee.errors.checkNote");
  let refundTo: string | null = null;
  if (g.needsNumber) {
    refundTo = normalizeBdMobile(input.refundTo ?? "");
    if (!refundTo) return fail("guarantee.errors.phone");
  }
  const { error } = await db().rpc("open_guarantee_claim", { p_contest_id: c.id, p_client_id: user!.id, p_refund_to: refundTo, p_note: note || null, p_disputed: check });
  if (error) {
    console.error("[guarantee] claim:", error.message);
    return fail(errorKey(claimErrorOf(error.message, error.code)));
  }
  const brand = c.brand_name as string;
  await tellClient("claimed", { clientId: user!.id, slug: c.slug as string, brand }, { routes: g.routes, amount: g.amount, late: g.state.late });
  await tellTeam("claimed", brand);
  refresh();
  return { ok: true };
}

/** Approve (the contest is cancelled and the money goes back) or reject (the client gets more days to pick). */
export async function decideGuaranteeClaim(input: { claimId: string; approve: boolean; reply?: string; internal?: string; exclude?: string; confirm?: string }): Promise<Result> {
  const admin = await adminUser("refunds.manage");
  if (!admin || !UUID.test(input.claimId)) return fail("auth.errors.generic");
  // Only a real true approves (a "false" string must never take the approve path).
  const approve = input.approve === true;
  const claim = await claimForAction(input.claimId);
  if (!claim || claim.status !== "pending" || !claim.contest_id) return fail("guarantee.errors.not_pending");
  const reply = clean(input.reply, REPLY_MAX);
  const internal = clean(input.internal, INTERNAL_MAX);
  let exclude: { designer_id: string; reason: string }[] = [];
  if (approve) {
    // Typing the contest number makes a slip on the wrong card impossible.
    const typed = (input.confirm ?? "").replace(/\D/g, "").replace(/^0+/, "");
    if (!claim.contest_number || typed !== String(claim.contest_number)) return fail("guarantee.errors.confirm");
    let raw: unknown = [];
    try {
      raw = input.exclude ? JSON.parse(input.exclude) : [];
    } catch {
      return fail("guarantee.errors.exclude");
    }
    const { data: client } = await db().from("profiles").select("is_test").eq("id", claim.client_id ?? "").maybeSingle();
    const counted = await countedNow(claim.contest_id, Boolean(client?.is_test));
    const cleaned = cleanExclusions(raw, counted);
    if (!cleaned) return fail("guarantee.errors.exclude");
    // Leaving designers out of the count is the owner's call.
    if (cleaned.length && !admin.isSuperAdmin) return fail("guarantee.errors.excludeSuper");
    exclude = cleaned;
  } else if (reply.length < REPLY_MIN) return fail("guarantee.errors.note");

  const s = await getSettings(["timers.repick_window_days"]);
  const { data, error } = await db().rpc("decide_guarantee_claim", {
    p_claim_id: claim.id,
    p_admin_id: admin.id,
    p_approve: approve,
    p_reply: reply || null,
    p_internal: internal || null,
    p_exclude: exclude,
    p_repick_days: s["timers.repick_window_days"],
  });
  if (error) {
    console.error("[guarantee] decide:", error.message);
    return fail(errorKey(claimErrorOf(error.message, error.code)));
  }
  const done = (Array.isArray(data) ? data[0] : data) as { amount: number; usd_cents: number; designers_at_decision: number | null; payments: PaidLine[] } | null;
  await audit(admin.id, approve ? "guarantee_approve" : "guarantee_reject", "guarantee_claim", claim.id, {
    contest: claim.contest_number,
    designers: approve ? done?.designers_at_decision : claim.designers_at_claim,
    amount: done?.amount ?? claim.amount,
    usd_cents: done?.usd_cents ?? claim.usd_cents,
    excluded: exclude.length ? exclude : undefined,
    reply: reply || undefined,
  });
  const to = { clientId: claim.client_id ?? "", slug: claim.slug ?? "", brand: claim.brand_name };
  if (claim.client_id && claim.slug) {
    if (approve) await tellClient("approved", to, { routes: routeAmounts(done?.payments ?? claim.payments ?? []), amount: done?.amount ?? claim.amount });
    else {
      const { data: c } = await db().from("contests").select("status, judging_ends_at").eq("id", claim.contest_id).maybeSingle();
      const until = c?.status === "judging" && c.judging_ends_at ? new Date(c.judging_ends_at as string) : null;
      await tellClient("rejected", to, { reason: reply, until, days: s["timers.repick_window_days"], late: !until });
    }
  }
  refresh();
  return { ok: true };
}

/**
 * "I'm sending it": one person pays a claim. The lock doesn't run out on its own (that person may already have sent
 * the money); only the Super admin can take it over, after checking with them.
 */
export async function startPaying(claimId: string): Promise<Result> {
  const admin = await adminUser("refunds.manage");
  if (!admin || !UUID.test(claimId)) return fail("auth.errors.generic");
  // Four eyes: whoever approved can't take the lock either (it would block everyone else).
  const claim = await claimForAction(claimId);
  if (!claim || claim.status !== "approved") return fail("guarantee.errors.not_approved");
  if (claim.decided_by === admin.id && !admin.isSuperAdmin) return fail("guarantee.errors.sameAdmin");
  let take = db().from("guarantee_claims").update({ paying_by: admin.id, paying_since: new Date().toISOString() }).eq("id", claimId).eq("status", "approved");
  if (!admin.isSuperAdmin) take = take.or(`paying_by.is.null,paying_by.eq.${admin.id}`);
  const { data, error } = await take.select("id");
  if (error) return fail("auth.errors.generic");
  if (!data?.length) return fail("guarantee.errors.locked");
  refresh();
  return { ok: true };
}

/** The money went back: one reference per route (bKash TrxID, Stripe re_… id). Then the client and designers hear. */
export async function markGuaranteeRefunded(input: { claimId: string; refs: Record<string, string> }): Promise<Result> {
  const admin = await adminUser("refunds.manage");
  if (!admin || !UUID.test(input.claimId)) return fail("auth.errors.generic");
  const claim = await claimForAction(input.claimId);
  if (!claim || claim.status !== "approved") return fail("guarantee.errors.not_approved");
  // Four eyes: whoever approved doesn't also mark it paid (the owner may do both).
  if (claim.decided_by === admin.id && !admin.isSuperAdmin) return fail("guarantee.errors.sameAdmin");
  // Only the person who pressed "I'm sending it" marks it (owner, 2026-10-21): so two people never both send money.
  if (claim.paying_by !== admin.id) return fail(claim.paying_by ? "guarantee.errors.locked" : "guarantee.errors.lockFirst");
  const routes = refundRoutes((claim.payments ?? []) as PaidLine[]);
  // The client's own payment references are not refunds: pasting one by mistake is refused.
  const incoming = new Set(((claim.payments ?? []) as PaidLine[]).flatMap((l) => [l.txn, l.intent]).filter((x): x is string => Boolean(x)).map((x) => x.toUpperCase()));
  if (claim.contest_id) {
    const { data: proofs } = await db().from("manual_payments").select("txn_id").eq("contest_id", claim.contest_id);
    for (const p of proofs ?? []) if (p.txn_id) incoming.add((p.txn_id as string).toUpperCase());
  }
  const refs: Record<string, string> = {};
  for (const r of routes) {
    if (r.kind === "none") continue;
    const ref = cleanRefundRef(r.kind, input.refs?.[r.key]);
    if (!ref) return fail(r.kind === "bkash" ? "guarantee.errors.bkashRef" : r.kind === "stripe" ? "guarantee.errors.stripeRef" : "guarantee.errors.ref");
    if (incoming.has(ref.toUpperCase())) return fail("guarantee.errors.refIsPayment");
    refs[r.key] = ref;
  }
  if (!refundsComplete(routes, refs)) return fail("guarantee.errors.ref");
  // One refund belongs to one payment: the same reference twice in one form is a slip.
  const given = Object.values(refs).map((r) => r.toUpperCase());
  if (new Set(given).size !== given.length) return fail("guarantee.errors.refUsed");
  // A reference can't be used for two claims.
  for (const ref of Object.values(refs)) {
    const { data: used } = await db().from("guarantee_claims").select("id").neq("id", claim.id).ilike("refund_ref", `%${ref}%`).limit(1);
    if (used?.length) return fail("guarantee.errors.refUsed");
  }
  const summary = Object.values(refs).join(" ") || "QA";
  const { data, error } = await db()
    .from("guarantee_claims")
    .update({ status: "refunded", refund_refs: refs, refund_ref: summary, refunded_by: admin.id, refunded_at: new Date().toISOString(), paying_by: null, paying_since: null })
    .eq("id", claim.id)
    .eq("status", "approved")
    .eq("paying_by", admin.id)
    .select("id");
  if (error || !data?.length) return fail("guarantee.errors.not_approved");
  await audit(admin.id, "guarantee_refunded", "guarantee_claim", claim.id, { contest: claim.contest_number, refs, amount: claim.amount, usd_cents: claim.usd_cents });
  if (claim.client_id && claim.slug) await tellClient("refunded", { clientId: claim.client_id, slug: claim.slug, brand: claim.brand_name }, { routes: routeAmounts(claim.payments ?? []), amount: claim.amount, ref: summary });
  // The designers hear only once the money is back (owner, 2026-10-21): no prize or share is paid.
  if (claim.contest_id) {
    const { data: rows } = await db().from("entries").select("designer_id").eq("contest_id", claim.contest_id).not("status", "in", "(removed,withdrawn)");
    await notify([...new Set((rows ?? []).map((r) => r.designer_id as string))], "guarantee_designers", { brand: claim.brand_name, number: claim.min_designers }, null);
  }
  refresh();
  return { ok: true };
}
