import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { getPaymentGateway } from "@/lib/payments";
import type { PaymentMethod, VerifiedCallback } from "@/lib/payments/gateway";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkLimits } from "@/lib/logo-check/run";
import type { AddonKey } from "./addons";

/** Add-ons and extensions bought after launch (BLUEPRINT §7.4, owner 2026-10-08). */

export type AddonPrices = Record<AddonKey, number> & { extensionPerDay: number; extensionDays: number[]; checkerFreeFrom: number };

export async function addonPrices(): Promise<AddonPrices> {
  const s = await getSettings([
    "upgrades.promoted_price",
    "upgrades.private_price",
    "upgrades.blind_price",
    "upgrades.logo_scan_price",
    "upgrades.extension_price_per_day",
    "upgrades.extension_days_options",
    "upgrades.logo_check_free_from",
  ]);
  return {
    promote: s["upgrades.promoted_price"],
    private: s["upgrades.private_price"],
    blind: s["upgrades.blind_price"],
    logo_scan: s["upgrades.logo_scan_price"],
    extensionPerDay: s["upgrades.extension_price_per_day"],
    extensionDays: s["upgrades.extension_days_options"],
    checkerFreeFrom: s["upgrades.logo_check_free_from"],
  };
}

type ContestFlags = { id: string; slug: string; client_id: string; status: string; brand_name: string; prize_amount: number; is_promoted: boolean; is_private: boolean; is_blind: boolean; logo_scan: boolean };

const ACTIVE: Record<AddonKey, keyof ContestFlags> = { promote: "is_promoted", private: "is_private", blind: "is_blind", logo_scan: "logo_scan" };

export type AddonOrder = { addon: AddonKey } | { extensionDays: number };

/** Records the payment and returns the gateway checkout URL. */
export async function startAddonCheckout(
  user: CurrentUser,
  contestId: string,
  order: AddonOrder,
  method: PaymentMethod,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: "not_found" | "closed" | "active" | "invalid" }> {
  const db = createAdminClient();
  const { data: c } = await db
    .from("contests")
    .select("id, slug, client_id, status, brand_name, prize_amount, is_promoted, is_private, is_blind, logo_scan")
    .eq("id", contestId)
    .maybeSingle<ContestFlags>();
  if (!c || c.client_id !== user.id) return { ok: false, error: "not_found" };
  // The AI copyright checker can also be bought while the client is judging (owner, 2026-10-10).
  const checkerWhileJudging = "addon" in order && order.addon === "logo_scan" && c.status === "judging";
  if (c.status !== "open" && !checkerWhileJudging) return { ok: false, error: "closed" };

  const prices = await addonPrices();
  let amount: number;
  let row: { purpose: "addon" | "extension"; addon: AddonKey | null; extension_days: number | null };
  if ("addon" in order) {
    if (c[ACTIVE[order.addon]]) return { ok: false, error: "active" };
    // Free with this prize: nothing to buy (owner, 2026-10-10).
    if (order.addon === "logo_scan" && c.prize_amount >= (await checkLimits()).freeFrom) return { ok: false, error: "active" };
    amount = prices[order.addon];
    row = { purpose: "addon", addon: order.addon, extension_days: null };
  } else {
    if (!prices.extensionDays.includes(order.extensionDays)) return { ok: false, error: "invalid" };
    amount = prices.extensionPerDay * order.extensionDays;
    row = { purpose: "extension", addon: null, extension_days: order.extensionDays };
  }
  if (amount <= 0) return { ok: false, error: "invalid" };

  const gateway = getPaymentGateway();
  const { data: payment, error } = await db
    .from("payments")
    .insert({ contest_id: c.id, client_id: user.id, gateway: gateway.name, method, amount, ...row })
    .select("id")
    .single();
  if (error || !payment) return { ok: false, error: "invalid" };

  const { redirectUrl } = await gateway.createCheckout({
    paymentId: payment.id as string,
    amount,
    method,
    description: `${c.brand_name} — ${"addon" in order ? order.addon : `+${order.extensionDays} days`}`,
    customer: { name: user.name, mobile: user.mobile },
  });
  return { ok: true, redirectUrl };
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
