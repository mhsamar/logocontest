import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { getPaymentGateway } from "@/lib/payments";
import type { VerifiedCallback } from "@/lib/payments/gateway";
import { gatewayMethod, isManual, type MethodKey } from "@/lib/payments/manual-rules";
import { expireSession, openStripeCheckout } from "@/lib/payments/stripe-api";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKABLE_STATUSES } from "@/lib/logo-check/rules";
import type { AddonKey } from "./addons";
import { addonsFreeFor } from "./pricing";

/** Add-ons and extensions bought after launch (BLUEPRINT §7.4, owner 2026-10-08). */

/** `allFreeFrom`: every add-on is free with a prize of at least this (owner, 2026-10-22); 0 = never. Extra days stay paid. */
export type AddonPrices = Record<AddonKey, number> & { extensionPerDay: number; extensionDays: number[]; checkerFreeFrom: number; allFreeFrom: number };

export async function addonPrices(): Promise<AddonPrices> {
  const s = await getSettings([
    "upgrades.promoted_price",
    "upgrades.private_price",
    "upgrades.blind_price",
    "upgrades.logo_scan_price",
    "upgrades.extension_price_per_day",
    "upgrades.extension_days_options",
    "upgrades.logo_check_free_from",
    "upgrades.all_free_from",
  ]);
  return {
    promote: s["upgrades.promoted_price"],
    private: s["upgrades.private_price"],
    blind: s["upgrades.blind_price"],
    logo_scan: s["upgrades.logo_scan_price"],
    extensionPerDay: s["upgrades.extension_price_per_day"],
    extensionDays: s["upgrades.extension_days_options"],
    checkerFreeFrom: s["upgrades.logo_check_free_from"],
    allFreeFrom: s["upgrades.all_free_from"],
  };
}

type ContestFlags = { id: string; slug: string; client_id: string; status: string; brand_name: string; prize_amount: number; is_promoted: boolean; is_private: boolean; is_blind: boolean; logo_scan: boolean };

const ACTIVE: Record<AddonKey, keyof ContestFlags> = { promote: "is_promoted", private: "is_private", blind: "is_blind", logo_scan: "logo_scan" };

export type AddonOrder = { addon: AddonKey } | { extensionDays: number };

/**
 * Records the payment and returns the gateway checkout URL: the pay page for manual bKash, or Stripe's page for a
 * card payment in US dollars (owner, 2026-10-14).
 */
export async function startAddonCheckout(
  user: CurrentUser,
  contestId: string,
  order: AddonOrder,
  key: MethodKey,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: "not_found" | "closed" | "active" | "invalid" }> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("contests")
    .select("id, slug, client_id, status, brand_name, prize_amount, is_promoted, is_private, is_blind, logo_scan")
    .eq("id", contestId)
    .maybeSingle<ContestFlags>();
  if (!c || c.client_id !== user.id) return { ok: false, error: "not_found" };
  // The AI copyright checker can also be bought while the client is judging (owner, 2026-10-10) and after a winner is picked (2026-10-11).
  const checkerWhileJudging = "addon" in order && order.addon === "logo_scan" && (CHECKABLE_STATUSES as readonly string[]).includes(c.status);
  if (c.status !== "open" && !checkerWhileJudging) return { ok: false, error: "closed" };

  const prices = await addonPrices();
  let amount: number;
  let row: { purpose: "addon" | "extension"; addon: AddonKey | null; extension_days: number | null };
  if ("addon" in order) {
    // The AI logo checker is free on every logo contest (owner, 2026-10-14): nothing to buy.
    if (order.addon === "logo_scan") return { ok: false, error: "active" };
    if (c[ACTIVE[order.addon]]) return { ok: false, error: "active" };
    amount = prices[order.addon];
    row = { purpose: "addon", addon: order.addon, extension_days: null };
  } else {
    if (!prices.extensionDays.includes(order.extensionDays)) return { ok: false, error: "invalid" };
    amount = prices.extensionPerDay * order.extensionDays;
    row = { purpose: "extension", addon: null, extension_days: order.extensionDays };
  }
  if (amount <= 0) return { ok: false, error: "invalid" };

  const manual = isManual(key);
  const method = manual ? "bkash" : gatewayMethod(key as "bkash_api" | "sslcommerz" | "stripe");
  const gateway = manual || key === "stripe" ? null : getPaymentGateway();
  const { data: payment, error } = await db
    .from("payments")
    .insert({ contest_id: c.id, client_id: user.id, gateway: gateway?.name ?? key, method, amount, ...row })
    .select("id")
    .single();
  if (error || !payment) return { ok: false, error: "invalid" };
  if (key === "stripe") {
    const what = "addon" in order ? order.addon : `+${order.extensionDays} days`;
    const url = await openStripeCheckout({ kind: "addon", paymentId: payment.id as string, bdt: amount, name: `logocontest.bd · ${c.brand_name} · ${what}`, email: user.email, cancelPath: `/dashboard/contests/${c.slug}` });
    return url ? { ok: true, redirectUrl: url } : { ok: false, error: "invalid" };
  }
  if (!gateway) return { ok: true, redirectUrl: `/pay/addon/${payment.id}` };

  const { redirectUrl } = await gateway.createCheckout({
    paymentId: payment.id as string,
    amount,
    method,
    description: `${c.brand_name} — ${"addon" in order ? order.addon : `+${order.extensionDays} days`}`,
    customer: { name: user.name, mobile: user.mobile },
  });
  return { ok: true, redirectUrl };
}

/**
 * An add-on a running contest gets free because its prize is at least `upgrades.all_free_from` (owner, 2026-10-22):
 * switched on at once, with no payment. Extra days are never free. "not_free" when the prize is below the line.
 */
export async function activateFreeAddon(user: CurrentUser, contestId: string, addon: AddonKey): Promise<{ ok: true; slug: string } | { ok: false; error: "not_found" | "closed" | "active" | "not_free" | "waiting" }> {
  if (addon === "logo_scan") return { ok: false, error: "active" };
  const { data: c } = await createAdminClient()
    .from("contests")
    .select("id, slug, client_id, status, brand_name, prize_amount, is_promoted, is_private, is_blind, logo_scan")
    .eq("id", contestId)
    .maybeSingle<ContestFlags>();
  if (!c || c.client_id !== user.id) return { ok: false, error: "not_found" };
  const prices = await addonPrices();
  // Free from the prize, or an add-on whose price the team set to ৳0 (a ৳0 payment can't be made).
  if (!addonsFreeFor(c.prize_amount, { addonsFreeFrom: prices.allFreeFrom }) && prices[addon] > 0) return { ok: false, error: "not_free" };
  return switchOnAddon(c.id, addon);
}

/**
 * Switches one add-on on with no payment: the contest is open, the add-on still off, and no bKash payment for it waits
 * for the team (else approving it later would charge for one given free). Shared by a client's free add-on and the
 * Super admin's grant (owner, 2026-10-26), so both go the same safe way.
 */
export async function switchOnAddon(contestId: string, addon: Exclude<AddonKey, "logo_scan">): Promise<{ ok: true; slug: string } | { ok: false; error: "not_found" | "closed" | "active" | "waiting" }> {
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("id, slug, client_id, status, brand_name, prize_amount, is_promoted, is_private, is_blind, logo_scan").eq("id", contestId).maybeSingle<ContestFlags>();
  if (!c) return { ok: false, error: "not_found" };
  if (c.status !== "open") return { ok: false, error: "closed" };
  if (c[ACTIVE[addon]]) return { ok: false, error: "active" };
  // Its checkouts still open, so nobody pays for one that is on free: a bKash payment already sent waits for the team
  // (they decide it first); a card page still open is closed at Stripe (paid already, or Stripe can't be reached:
  // wait too); a bKash payment nobody sent is closed.
  const { data: open } = await db.from("payments").select("id, gateway, provider_ref").eq("contest_id", c.id).eq("addon", addon).eq("status", "initiated");
  const ids = (open ?? []).map((p) => p.id as string);
  if (ids.length) {
    const { count } = await db.from("manual_payments").select("id", { count: "exact", head: true }).in("payment_id", ids).eq("status", "pending");
    if ((count ?? 0) > 0) return { ok: false, error: "waiting" };
    for (const p of open ?? []) {
      if (p.gateway === "stripe" && p.provider_ref && !(await expireSession(p.provider_ref as string))) return { ok: false, error: "waiting" };
      await db.rpc("fail_addon_payment", { p_payment_id: p.id, p_raw: { closed: "switched on without payment" } });
    }
  }
  // Only while the contest is open and the add-on still off, so two clicks never do it twice.
  const { data } = await db.from("contests").update({ [ACTIVE[addon]]: true }).eq("id", c.id).eq("status", "open").eq(ACTIVE[addon], false).select("id");
  if (!data?.length) return { ok: false, error: "active" };
  return { ok: true, slug: c.slug };
}

/** True when this payment buys an add-on or extension (not the contest itself). */
export async function isAddonPayment(paymentId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("payments").select("purpose").eq("id", paymentId).maybeSingle();
  return data?.purpose === "addon" || data?.purpose === "extension";
}

/** Applies a verified gateway callback for an add-on payment. Returns the contest slug. */
export async function settleAddonPayment(verified: VerifiedCallback): Promise<{ slug: string | null; status: "paid" | "failed" }> {
  const db = createAdminClient();
  const { data: p } = await db.from("payments").select("purpose, extension_days, contest:contests!contest_id(id, slug, brand_name)").eq("id", verified.paymentId).maybeSingle();
  const c = (Array.isArray(p?.contest) ? p?.contest[0] : p?.contest) as { id: string; slug: string; brand_name: string } | null;
  const slug = c?.slug ?? null;
  if (verified.status === "failed") {
    await db.rpc("fail_addon_payment", { p_payment_id: verified.paymentId, p_raw: verified.raw });
    return { slug, status: "failed" };
  }
  const { error } = await db.rpc("confirm_addon_payment", {
    p_payment_id: verified.paymentId,
    p_amount: verified.amount,
    p_gateway_txn_id: verified.txnId,
    p_raw: verified.raw,
  });
  if (error) {
    console.error("[addons] confirm failed:", error.message);
    return { slug, status: "failed" };
  }
  if (c && p?.purpose === "extension") {
    await notify(await contestDesignerIds(c.id), "contest_extended", { brand: c.brand_name, days: p.extension_days as number }, `/contest/${c.slug}`);
  }
  return { slug, status: "paid" };
}
