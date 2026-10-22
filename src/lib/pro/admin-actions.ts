"use server";

import { refresh } from "next/cache";
import { adminUser } from "@/lib/admin/core";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_FEATURES, isProActive, type ProFeature } from "./rules";
import { getProSettings } from "./settings";
import { avatarUrl } from "@/lib/profile/avatar";
import { getSubscription, proIdsAmong, trialIdsAmong } from "./status";
import { cancelPro, freeMonthEnd, grantPro, logFunnel, logProActivity, tellDesigner } from "./subscription";
import { cancelTrial, extendTrial, startTrial } from "./trial";

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
  checkLowMax: number;
  checkMediumMax: number;
  freeTrialEnabled: boolean;
  freeTrialDays: number;
  trialLogoChecks: number;
  trialPortfolioLimit: number;
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
  // Match levels (owner, 2026-10-14): Low 0–low %, Medium up to medium %, High above.
  if (!intIn(i.checkLowMax, 0, 98) || !intIn(i.checkMediumMax, i.checkLowMax + 1, 99)) return fail("pro.admin.errors.levels");
  // 3-day free Pro Trial (owner, 2026-10-14).
  if (typeof i.freeTrialEnabled !== "boolean" || !intIn(i.freeTrialDays, 1, 30) || !intIn(i.trialLogoChecks, 0, 1000) || !intIn(i.trialPortfolioLimit, 0, 1000)) return fail("pro.admin.errors.trialLimits");
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
    check_low_max: i.checkLowMax,
    check_medium_max: i.checkMediumMax,
    free_trial_enabled: i.freeTrialEnabled,
    free_trial_days: i.freeTrialDays,
    trial_logo_checks: i.trialLogoChecks,
    trial_portfolio_limit: i.trialPortfolioLimit,
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
    check_low_max: before.checkLowMax,
    check_medium_max: before.checkMediumMax,
    free_trial_enabled: before.freeTrialEnabled,
    free_trial_days: before.freeTrialDays,
    trial_logo_checks: before.trialLogoChecks,
    trial_portfolio_limit: before.trialPortfolioLimit,
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
  const { data } = await db().from("profiles").select("id, role, status, suspended_until").eq("username", name).maybeSingle();
  if (!data || data.role !== "designer" || !usable(data)) return fail("pro.admin.errors.notFound");
  return manageProMember(data.id as string, "free_month");
}

/** Active, or a suspension that has already ended (the job writes "active" back a little later). */
const usable = (p: { status: unknown; suspended_until?: unknown }) =>
  p.status === "active" || (p.status === "suspended" && Boolean(p.suspended_until) && new Date(p.suspended_until as string).getTime() <= Date.now());

export type ProDesignerHit = { id: string; name: string; username: string; avatar: string | null; test: boolean; trial: boolean };

/**
 * Give Pro (owner, 2026-10-22): tapping the box lists the newest active designers, typing a name or @username narrows
 * it. Paying members are left out (they have Manage); test accounts come last, marked. Never shows contact details.
 */
export async function searchProDesigners(query: string): Promise<ProDesignerHit[]> {
  if (!(await adminUser("pro.manage"))) return [];
  const q = String(query ?? "").replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim().replace(/^@/, "").slice(0, 40);
  let req = db()
    .from("profiles")
    .select("id, name, username, avatar_path, is_test, status, suspended_until")
    .eq("role", "designer")
    .in("status", ["active", "suspended"])
    .not("username", "is", null)
    .order("is_test", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(80);
  if (q) req = req.or(`name.ilike."%${q}%",username.ilike."%${q}%"`);
  const rows = ((await req).data ?? []).filter(usable);
  const ids = rows.map((r) => r.id as string);
  const [pro, trial] = await Promise.all([proIdsAmong(ids), trialIdsAmong(ids)]);
  return rows
    .filter((r) => !pro.has(r.id as string) || trial.has(r.id as string))
    .map((r) => ({ id: r.id as string, name: ((r.name as string) ?? "").trim(), username: r.username as string, avatar: avatarUrl(r.avatar_path as string | null), test: Boolean(r.is_test), trial: trial.has(r.id as string) }))
    .sort((a, b) => Number(a.test) - Number(b.test))
    .slice(0, 30);
}

// ---------------------------------------------------------------------------------------------------------------
// 3-day free Pro Trial (owner, 2026-10-14): start one for a designer, extend it, or end it.
// ---------------------------------------------------------------------------------------------------------------

/** Starts a trial for a designer who never had one (works while trials are off). */
export async function adminStartTrial(username: string): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin) return fail("auth.errors.generic");
  const name = (username ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(name)) return fail("pro.trial.admin.errors.notFound");
  const { data } = await db().from("profiles").select("id, role").eq("username", name).maybeSingle();
  if (!data || data.role !== "designer") return fail("pro.trial.admin.errors.notFound");
  const res = await startTrial(data.id as string, { kind: "admin", adminId: admin.id });
  if (!res.ok) return fail(res.error === "used" ? "pro.trial.admin.errors.used" : "pro.trial.admin.errors.generic");
  refresh();
  return { ok: true };
}

export async function adminExtendTrial(designerId: string, days: number): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || !UUID.test(designerId) || !Number.isInteger(days) || days < 1 || days > 30) return fail("auth.errors.generic");
  if (!(await extendTrial(designerId, days, admin.id))) return fail("pro.trial.admin.errors.generic");
  refresh();
  return { ok: true };
}

export async function adminCancelTrial(designerId: string): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || !UUID.test(designerId)) return fail("auth.errors.generic");
  if (!(await cancelTrial(designerId, { kind: "admin", adminId: admin.id }))) return fail("pro.trial.admin.errors.generic");
  refresh();
  return { ok: true };
}

/** Admin › Pro plan › Invitations (owner, 2026-10-14): take an invitation back. The designer no longer sees it. */
export async function adminRemoveInvite(contestId: string, designerId: string): Promise<Result> {
  const admin = await adminUser("pro.manage");
  if (!admin || !UUID.test(contestId) || !UUID.test(designerId)) return fail("auth.errors.generic");
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("contest_invites")
    .update({ status: "removed", removed_by: admin.id, removed_at: now })
    .eq("contest_id", contestId)
    .eq("designer_id", designerId)
    .neq("status", "removed")
    .select("status");
  if (error || !data?.length) return fail("pro.trial.admin.errors.generic");
  await logProActivity(admin.id, "admin_removed_invite", designerId, null, { contest: contestId });
  refresh();
  return { ok: true };
}
