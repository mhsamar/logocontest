import "server-only";
import { contestAmountsWithFee, normalizePromo, PROMO_CODE, type PromoKind } from "@/lib/payments/manual-rules";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Promo codes (owner, 2026-10-14; Admin › Payments › Promo codes). A code is reserved for one person when they use
 * it (a one-time code then can't be taken by anyone else), "used" when the payment is approved or the win is
 * counted, and released if they take it off.
 */

const db = () => createAdminClient();

export type Reserved = { redemptionId: string; codeId: string; code: string; kind: PromoKind; value: number };
export type PromoError = "pay.promo.notFound" | "pay.promo.used" | "pay.promo.inactive";

const ERRORS: Record<string, PromoError> = { promo_not_found: "pay.promo.notFound", promo_used: "pay.promo.used", promo_inactive: "pay.promo.inactive" };

/** Reserve a code of one of these kinds for this person (the same person asking again gets the same reservation). */
export async function reservePromo(raw: string, userId: string, kinds: PromoKind[]): Promise<{ ok: true; promo: Reserved } | { ok: false; error: PromoError }> {
  const code = normalizePromo(raw ?? "");
  if (!PROMO_CODE.test(code)) return { ok: false, error: "pay.promo.notFound" };
  const { data, error } = await db().rpc("reserve_promo", { p_code: code, p_user_id: userId, p_kinds: kinds });
  if (error || !data) {
    const key = Object.keys(ERRORS).find((k) => error?.message?.includes(k));
    return { ok: false, error: key ? ERRORS[key] : "pay.promo.notFound" };
  }
  const r = data as { id: string; code_id: string; value: number };
  const { data: c } = await db().from("promo_codes").select("kind").eq("id", r.code_id).single();
  return { ok: true, promo: { redemptionId: r.id, codeId: r.code_id, code, kind: c?.kind as PromoKind, value: r.value } };
}

/** Checks a code without keeping it (the wizard's and the Pro page's "Apply"): the same rules as reserving. */
export async function lookupPromo(raw: string, userId: string, kind: PromoKind): Promise<{ ok: true; code: string; value: number } | { ok: false; error: PromoError }> {
  const code = normalizePromo(raw ?? "");
  if (!PROMO_CODE.test(code)) return { ok: false, error: "pay.promo.notFound" };
  const { data: c } = await db().from("promo_codes").select("id, kind, value, mode, max_uses, starts_at, ends_at, active").eq("code", code).maybeSingle();
  if (!c || c.kind !== kind) return { ok: false, error: "pay.promo.notFound" };
  const { data: mine } = await db().from("promo_redemptions").select("status").eq("code_id", c.id).eq("user_id", userId).neq("status", "released").maybeSingle();
  if (mine?.status === "used") return { ok: false, error: "pay.promo.used" };
  if (mine) return { ok: true, code, value: c.value as number };
  const now = Date.now();
  if (!c.active || (c.starts_at && new Date(c.starts_at as string).getTime() > now) || (c.ends_at && new Date(c.ends_at as string).getTime() <= now)) return { ok: false, error: "pay.promo.inactive" };
  const { count } = await db().from("promo_redemptions").select("id", { count: "exact", head: true }).eq("code_id", c.id).neq("status", "released");
  if ((c.mode === "single" && (count ?? 0) >= 1) || (c.max_uses && (count ?? 0) >= (c.max_uses as number))) return { ok: false, error: "pay.promo.used" };
  return { ok: true, code, value: c.value as number };
}

export async function releasePromo(redemptionId: string | null | undefined): Promise<void> {
  if (!redemptionId) return;
  await db().from("promo_redemptions").update({ status: "released" }).eq("id", redemptionId).eq("status", "reserved");
}

export async function markPromoUsed(redemptionId: string | null | undefined, extra: { contestId?: string | null; paymentId?: string | null } = {}): Promise<void> {
  if (!redemptionId) return;
  await db()
    .from("promo_redemptions")
    .update({ status: "used", used_at: new Date().toISOString(), ...(extra.contestId ? { contest_id: extra.contestId } : {}), ...(extra.paymentId ? { payment_id: extra.paymentId } : {}) })
    .eq("id", redemptionId)
    .eq("status", "reserved");
}

/**
 * A client's fee code on their contest, just before the payment is made (owner, 2026-10-14: 25% → 20/15/10/5/0).
 * Runs after the contest was re-priced: the fee becomes the code's percent (never more than the normal fee), the
 * total follows, and the code is kept on the contest. No code: a code that was on the contest is taken off again.
 * Returns the total to charge.
 */
export async function applyContestPromo(contest: { id: string; amounts: { prize: number; serviceFee: number; upgrades: number; total: number } }, promo: Reserved | null): Promise<number> {
  const { data: row } = await db().from("contests").select("promo_redemption_id").eq("id", contest.id).maybeSingle();
  const previous = (row?.promo_redemption_id as string | null) ?? null;
  if (previous && previous !== promo?.redemptionId) await releasePromo(previous);
  if (!promo) {
    if (previous) await db().from("contests").update({ promo_redemption_id: null }).eq("id", contest.id);
    return contest.amounts.total;
  }
  const a = contest.amounts;
  const serviceFee = Math.min(a.serviceFee, contestAmountsWithFee({ prize: a.prize, upgrades: a.upgrades }, promo.value).serviceFee);
  const total = a.prize + serviceFee + a.upgrades;
  const { error } = await db().from("contests").update({ service_fee_amount: serviceFee, total_amount: total, promo_redemption_id: promo.redemptionId }).eq("id", contest.id);
  if (error) {
    console.error("[promo] contest update failed:", error.message);
    return a.total;
  }
  await db().from("promo_redemptions").update({ contest_id: contest.id }).eq("id", promo.redemptionId);
  return total;
}

/** A designer's fee code waiting for their next win, if any. */
export async function pendingDesignerFee(designerId: string): Promise<{ redemptionId: string; value: number; code: string } | null> {
  const { data } = await db()
    .from("promo_redemptions")
    .select("id, value, code:promo_codes!code_id(code, kind)")
    .eq("user_id", designerId)
    .eq("status", "reserved")
    .order("created_at", { ascending: true })
    .limit(10);
  for (const r of data ?? []) {
    const c = (Array.isArray(r.code) ? r.code[0] : r.code) as { code: string; kind: string } | null;
    if (c?.kind === "designer_fee") return { redemptionId: r.id as string, value: r.value as number, code: c.code };
  }
  return null;
}

/** A contest payment was paid (gateway or approved bKash): the contest's fee code counts as used. */
export async function markContestPromoUsed(paymentId: string): Promise<void> {
  const { data: p } = await db().from("payments").select("contest_id, purpose, status").eq("id", paymentId).maybeSingle();
  if (!p || p.purpose !== "contest" || p.status !== "paid") return;
  const { data: c } = await db().from("contests").select("promo_redemption_id").eq("id", p.contest_id).maybeSingle();
  await markPromoUsed(c?.promo_redemption_id as string | null, { contestId: p.contest_id as string, paymentId });
}

/** A Pro payment was paid: its discount code counts as used. */
export async function markProPromoUsed(paymentId: string): Promise<void> {
  const { data } = await db().from("promo_redemptions").select("id").eq("payment_id", paymentId).eq("status", "reserved");
  for (const r of data ?? []) await markPromoUsed(r.id as string);
}

/**
 * Lifecycle job: a client or Pro code reserved at a checkout that was never paid goes back after `days`, so a
 * one-time code isn't lost. Not while a bKash payment for it is waiting for approval. Designer codes stay until
 * the designer's next win.
 */
export async function releaseStalePromos(now: Date, days = 7): Promise<number> {
  const before = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data } = await db()
    .from("promo_redemptions")
    .select("id, contest_id, payment_id, code:promo_codes!code_id(kind)")
    .eq("status", "reserved")
    .lt("created_at", before)
    .limit(200);
  let released = 0;
  for (const r of data ?? []) {
    const c = (Array.isArray(r.code) ? r.code[0] : r.code) as { kind: string } | null;
    if (!c || c.kind === "designer_fee") continue;
    let waiting = db().from("manual_payments").select("id", { count: "exact", head: true }).eq("status", "pending");
    waiting = r.contest_id ? waiting.eq("contest_id", r.contest_id) : waiting.eq("payment_id", r.payment_id ?? "00000000-0000-0000-0000-000000000000");
    const { count } = await waiting;
    if ((count ?? 0) > 0) continue;
    await releasePromo(r.id as string);
    if (r.contest_id) await db().from("contests").update({ promo_redemption_id: null }).eq("id", r.contest_id).eq("promo_redemption_id", r.id).in("status", ["draft", "pending_payment"]);
    released++;
  }
  return released;
}

/**
 * The fee on a designer's win with their waiting fee code (owner, 2026-10-14: 15% down to 10, 5 or 0, on the next
 * win only). Never raises the fee. Call `markPromoUsed(redemptionId, { contestId })` once the winner is saved.
 */
export async function designerFeeWithCode(designerId: string, normalRate: number): Promise<{ rate: number; redemptionId: string | null }> {
  const code = await pendingDesignerFee(designerId);
  if (!code || code.value >= normalRate) return { rate: normalRate, redemptionId: null };
  return { rate: code.value, redemptionId: code.redemptionId };
}
