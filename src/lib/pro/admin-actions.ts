"use server";

import { refresh } from "next/cache";
import { adminUser } from "@/lib/admin/core";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_FEATURES, isProActive, type ProFeature } from "./rules";
import { getProSettings } from "./settings";
import { getSubscription } from "./status";
import { cancelPro, freeMonthEnd, grantPro, logFunnel, logProActivity, tellDesigner } from "./subscription";

type Result = { ok: true } | { ok: false; error: MessageKey; params?: MessageParams };
const fail = (error: MessageKey, params?: MessageParams): Result => ({ ok: false, error, params });
const db = () => createAdminClient();

export type ProSettingsInput = {
  priceBdt: number;
  offerEnabled: boolean;
  offerPriceBdt: number | null;
  offerAudience: "new" | "all";
  offerStartsAt: string | null;
  offerEndsAt: string | null;
  trialDays: number;
  promoCode: string | null;
  promoPriceBdt: number | null;
  proLogoChecks: number;
  basicLogoChecks: number;
  proPortfolioLimit: number;
  proEntriesPerContest: number | null;
  basicEntriesPerContest: number;
  invitesPerContest: number;
  earlyAccessMinutes: number;
  features: Record<ProFeature, boolean>;
  autoRemind: boolean;
};

const intIn = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isoOrNull = (v: unknown) => (v === null || v === "" ? null : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);

/**
 * Admin › Pro plan › Save (owner, 2026-10-13): price, offer, trial, promo code, limits and the feature switches. Each
 * changed value goes into the activity log (old → new). A new price applies to new buyers now and to each member
 * at their next renewal; members are told now, and again in the renewal reminder 7 days before.
 */
export async function saveProSettings(input: ProSettingsInput): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin) return fail("auth.errors.generic");
  const { settings: before, ready } = await getProSettings();
  if (!ready) return fail("pro.admin.errors.notReady");
  const i = input;
  if (!intIn(i.priceBdt, 1, 100000)) return fail("pro.admin.errors.price");
  if (i.offerEnabled && !intIn(i.offerPriceBdt, 0, 100000)) return fail("pro.admin.errors.offer");
  if (i.offerPriceBdt !== null && !intIn(i.offerPriceBdt, 0, 100000)) return fail("pro.admin.errors.offer");
  const starts = isoOrNull(i.offerStartsAt);
  const ends = isoOrNull(i.offerEndsAt);
  if (starts === undefined || ends === undefined || (starts && ends && ends <= starts)) return fail("pro.admin.errors.dates");
  if (!intIn(i.trialDays, 0, 90)) return fail("pro.admin.errors.trial");
  const promo = (i.promoCode ?? "").trim().toUpperCase() || null;
  if (promo && !/^[A-Z0-9]{3,20}$/.test(promo)) return fail("pro.admin.errors.promo");
  if (promo && !intIn(i.promoPriceBdt, 0, 100000)) return fail("pro.admin.errors.promoPrice");
  if (!intIn(i.proLogoChecks, 0, 10000) || !intIn(i.basicLogoChecks, 0, 10000)) return fail("pro.admin.errors.limit");
  if (!intIn(i.proPortfolioLimit, 0, 1000) || !intIn(i.basicEntriesPerContest, 1, 1000) || !intIn(i.invitesPerContest, 0, 100)) return fail("pro.admin.errors.limit");
  if (i.proEntriesPerContest !== null && !intIn(i.proEntriesPerContest, 1, 1000)) return fail("pro.admin.errors.limit");
  if (!intIn(i.earlyAccessMinutes, 0, 10080)) return fail("pro.admin.errors.early");
  if (!i.features || PRO_FEATURES.some((f) => typeof i.features[f] !== "boolean")) return fail("auth.errors.generic");

  const row: Record<string, unknown> = {
    price_bdt: i.priceBdt,
    offer_enabled: i.offerEnabled,
    offer_price_bdt: i.offerPriceBdt,
    offer_audience: i.offerAudience === "all" ? "all" : "new",
    offer_starts_at: starts,
    offer_ends_at: ends,
    trial_days: i.trialDays,
    promo_code: promo,
    promo_price_bdt: promo ? i.promoPriceBdt : null,
    pro_logo_checks: i.proLogoChecks,
    basic_logo_checks: i.basicLogoChecks,
    pro_portfolio_limit: i.proPortfolioLimit,
    pro_entries_per_contest: i.proEntriesPerContest,
    basic_entries_per_contest: i.basicEntriesPerContest,
    invites_per_contest: i.invitesPerContest,
    early_access_minutes: i.earlyAccessMinutes,
    auto_remind: i.autoRemind,
    ...Object.fromEntries(PRO_FEATURES.map((f) => [`f_${f}`, i.features[f]])),
    updated_at: new Date().toISOString(),
    updated_by: admin.id,
  };
  const old: Record<string, unknown> = {
    price_bdt: before.priceBdt,
    offer_enabled: before.offerEnabled,
    offer_price_bdt: before.offerPriceBdt,
    offer_audience: before.offerAudience,
    offer_starts_at: before.offerStartsAt?.toISOString() ?? null,
    offer_ends_at: before.offerEndsAt?.toISOString() ?? null,
    trial_days: before.trialDays,
    promo_code: before.promoCode,
    promo_price_bdt: before.promoPriceBdt,
    pro_logo_checks: before.proLogoChecks,
    basic_logo_checks: before.basicLogoChecks,
    pro_portfolio_limit: before.proPortfolioLimit,
    pro_entries_per_contest: before.proEntriesPerContest,
    basic_entries_per_contest: before.basicEntriesPerContest,
    invites_per_contest: before.invitesPerContest,
    early_access_minutes: before.earlyAccessMinutes,
    auto_remind: before.autoRemind,
    ...Object.fromEntries(PRO_FEATURES.map((f) => [`f_${f}`, before.features[f]])),
  };
  const changed = Object.keys(old).filter((k) => JSON.stringify(old[k]) !== JSON.stringify(row[k]));
  if (!changed.length) return { ok: true };
  const { error } = await db().from("pro_settings").update(row).eq("id", 1);
  if (error) return fail("admin.errors.generic");
  for (const k of changed) await logProActivity(admin.id, `set_${k}`, null, old[k], row[k]);

  if (changed.includes("price_bdt")) {
    const { data: subs } = await db().from("pro_subscriptions").select("designer_id").neq("status", "expired").gt("current_period_end", new Date().toISOString());
    const ids = (subs ?? []).map((s) => s.designer_id as string);
    if (ids.length) await notifyWithPush(ids, "pro_price_change", { amount: i.priceBdt }, "/dashboard/profile#subscription");
    if (ids.length) await logProActivity(null, "price_notice_sent", null, null, { members: ids.length, price: i.priceBdt });
  }
  refresh();
  return { ok: true };
}

/** The master switch "Pro plan for sale". Off: nobody can buy; members keep Pro until their end date. */
export async function setProForSale(on: boolean): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || typeof on !== "boolean") return fail("auth.errors.generic");
  const { settings, ready } = await getProSettings();
  if (!ready) return fail("pro.admin.errors.notReady");
  if (settings.isForSale === on) return { ok: true };
  const { error } = await db().from("pro_settings").update({ is_for_sale: on, updated_at: new Date().toISOString(), updated_by: admin.id }).eq("id", 1);
  if (error) return fail("admin.errors.generic");
  await logProActivity(admin.id, "set_is_for_sale", null, settings.isForSale, on);
  refresh();
  return { ok: true };
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Manage one member: extend 7 days, a free month, a new end date, or cancel (Pro stays until the end date). */
export async function manageProMember(designerId: string, action: "extend" | "free_month" | "set_end" | "cancel", endDate?: string): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || !UUID.test(designerId)) return fail("auth.errors.generic");
  const { settings, ready } = await getProSettings();
  if (!ready) return fail("pro.admin.errors.notReady");
  const { data: person } = await db().from("profiles").select("role").eq("id", designerId).maybeSingle();
  if (person?.role !== "designer") return fail("auth.errors.generic");
  const sub = await getSubscription(designerId);
  const before = sub ? { status: sub.status, until: sub.currentPeriodEnd.toISOString() } : null;

  if (action === "cancel") {
    if (!(await cancelPro(designerId, "other", "Cancelled by an admin", admin.id))) return fail("pro.admin.errors.notMember");
    refresh();
    return { ok: true };
  }
  let until: Date;
  if (action === "extend") until = new Date((isProActive(sub) ? sub!.currentPeriodEnd : new Date()).getTime() + 7 * 86_400_000);
  else if (action === "free_month") until = freeMonthEnd(sub);
  else {
    const d = endDate ? new Date(endDate) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getTime() <= Date.now() || d.getTime() > Date.now() + 3 * 366 * 86_400_000) return fail("pro.admin.errors.endDate");
    until = d;
  }
  const granted = await grantPro(designerId, { until, method: "free", priceBdt: sub?.priceBdt || settings.priceBdt });
  if (!granted) return fail("admin.errors.generic");
  await logProActivity(admin.id, action === "free_month" ? "gave_free_month" : action === "extend" ? "extended" : "changed_end_date", designerId, before, { status: granted.status, until: granted.currentPeriodEnd.toISOString() });
  const days = Math.max(1, Math.round((granted.currentPeriodEnd.getTime() - Date.now()) / 86_400_000));
  await tellDesigner(designerId, "pro_granted", { days }, "/dashboard");
  refresh();
  return { ok: true };
}

/** "Remind" in Clicked but did not buy: one friendly nudge with a one-tap link to checkout. */
export async function remindProClicker(designerId: string): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || !UUID.test(designerId)) return fail("auth.errors.generic");
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.isForSale) return fail("pro.admin.errors.notForSale");
  if (isProActive(await getSubscription(designerId))) return fail("pro.admin.errors.alreadyPro");
  await tellDesigner(designerId, "pro_checkout_reminder", { amount: settings.priceBdt }, "/pro/checkout");
  await logFunnel("reminded", { designerId, step: "admin" });
  await logProActivity(admin.id, "reminded", designerId, null, null);
  refresh();
  return { ok: true };
}

/** "Auto reminder after 1 hour and 3 days" in Clicked but did not buy. */
export async function setProAutoRemind(on: boolean): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || typeof on !== "boolean") return fail("auth.errors.generic");
  const { settings, ready } = await getProSettings();
  if (!ready) return fail("pro.admin.errors.notReady");
  if (settings.autoRemind === on) return { ok: true };
  const { error } = await db().from("pro_settings").update({ auto_remind: on, updated_at: new Date().toISOString(), updated_by: admin.id }).eq("id", 1);
  if (error) return fail("admin.errors.generic");
  await logProActivity(admin.id, "set_auto_remind", null, settings.autoRemind, on);
  refresh();
  return { ok: true };
}

/** Give a designer (by username) a free month of Pro from Admin › Pro plan. */
export async function grantProByUsername(username: string): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin) return fail("auth.errors.generic");
  const name = (username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(name)) return fail("pro.admin.errors.notFound");
  const { data } = await db().from("profiles").select("id, role").eq("username", name).maybeSingle();
  if (!data || data.role !== "designer") return fail("pro.admin.errors.notFound");
  return manageProMember(data.id as string, "free_month");
}
