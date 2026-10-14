"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n/translate";
import { proPriceWithCode } from "@/lib/payments/manual-rules";
import { priceQuote } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription, getTrial } from "@/lib/pro/status";
import { lookupPromo, reservePromo } from "./promos";

type Fail = { ok: false; error: MessageKey };

/**
 * Wallet › Promo code (owner, 2026-10-14): a designer adds a fee code; it is kept for them and lowers the fee on
 * their next win.
 */
export async function redeemDesignerCode(code: string): Promise<{ ok: true; code: string; fee: number } | Fail> {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return { ok: false, error: "pro.errors.designersOnly" };
  const res = await reservePromo(code, user.id, ["designer_fee"]);
  if (!res.ok) return { ok: false, error: res.error };
  refresh();
  return { ok: true, code: res.promo.code, fee: res.promo.value };
}

/** The Pro page's "Apply": the plan's own promo code, or a discount code, and the price with it. Nothing is kept. */
export async function previewProPromo(code: string): Promise<{ ok: true; code: string; amount: number; list: number; percent: number | null } | Fail> {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer") return { ok: false, error: "pay.promo.signIn" };
  const { settings, ready } = await getProSettings();
  if (!ready) return { ok: false, error: "pro.errors.notForSale" };
  const sub = await getSubscription(user.id);
  const firstTime = !sub && !(await getTrial(user.id));
  const plain = priceQuote(settings, { firstTime });
  const withPlanCode = priceQuote(settings, { firstTime, promo: code });
  if (withPlanCode.reason === "promo") return { ok: true, code: code.trim().toUpperCase(), amount: withPlanCode.amount, list: plain.amount, percent: null };
  const look = await lookupPromo(code, user.id, "pro_discount");
  if (!look.ok) return look;
  return { ok: true, code: look.code, amount: proPriceWithCode(plain.amount, look.value), list: plain.amount, percent: look.value };
}
