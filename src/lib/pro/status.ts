import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProActive, type SubStatus } from "./rules";
import { isTrialActive, type TrialStatus } from "./trial-rules";
import { getProSettings } from "./settings";

export type Subscription = {
  id: string;
  designerId: string;
  status: SubStatus;
  priceBdt: number;
  startedAt: Date;
  firstStartedAt: Date;
  currentPeriodEnd: Date;
  autoRenew: boolean;
  paymentMethod: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  winsAtStart: number;
  entriesAtStart: number;
  reminded7dAt: Date | null;
  reminded1dAt: Date | null;
};

export const SUB_COLUMNS =
  "id, designer_id, status, price_bdt, started_at, first_started_at, current_period_end, auto_renew, payment_method, cancel_reason, cancelled_at, wins_at_start, entries_at_start, reminded_7d_at, reminded_1d_at";

const d = (v: unknown) => (v ? new Date(v as string) : null);

export function toSubscription(r: Record<string, unknown>): Subscription {
  return {
    id: r.id as string,
    designerId: r.designer_id as string,
    status: r.status as SubStatus,
    priceBdt: (r.price_bdt as number) ?? 0,
    startedAt: new Date(r.started_at as string),
    firstStartedAt: new Date((r.first_started_at ?? r.started_at) as string),
    currentPeriodEnd: new Date(r.current_period_end as string),
    autoRenew: r.auto_renew !== false,
    paymentMethod: (r.payment_method as string | null) ?? null,
    cancelReason: (r.cancel_reason as string | null) ?? null,
    cancelledAt: d(r.cancelled_at),
    winsAtStart: (r.wins_at_start as number) ?? 0,
    entriesAtStart: (r.entries_at_start as number) ?? 0,
    reminded7dAt: d(r.reminded_7d_at),
    reminded1dAt: d(r.reminded_1d_at),
  };
}

/** A designer's subscription row (any status), or null. Null before migration 0046. */
export const getSubscription = cache(async (designerId: string): Promise<Subscription | null> => {
  const { ready } = await getProSettings();
  if (!ready || !designerId) return null;
  const { data } = await createAdminClient().from("pro_subscriptions").select(SUB_COLUMNS).eq("designer_id", designerId).maybeSingle();
  return data ? toSubscription(data as Record<string, unknown>) : null;
});

export type Trial = {
  id: string;
  designerId: string;
  status: TrialStatus;
  startedAt: Date;
  endsAt: Date;
  startedBy: "designer" | "admin";
  extendedDays: number;
  remindedAt: Date | null;
  endedAt: Date | null;
  upgradedAt: Date | null;
  upgradePaymentId: string | null;
};

export const TRIAL_COLUMNS = "id, designer_id, status, started_at, ends_at, started_by, extended_days, reminded_at, ended_at, upgraded_at, upgrade_payment_id";

export function toTrial(r: Record<string, unknown>): Trial {
  return {
    id: r.id as string,
    designerId: r.designer_id as string,
    status: r.status as TrialStatus,
    startedAt: new Date(r.started_at as string),
    endsAt: new Date(r.ends_at as string),
    startedBy: r.started_by === "admin" ? "admin" : "designer",
    extendedDays: (r.extended_days as number) ?? 0,
    remindedAt: d(r.reminded_at),
    endedAt: d(r.ended_at),
    upgradedAt: d(r.upgraded_at),
    upgradePaymentId: (r.upgrade_payment_id as string | null) ?? null,
  };
}

/** A designer's 3-day Pro Trial (any status; one per designer for life), or null. Null before migration 0048. */
export const getTrial = cache(async (designerId: string): Promise<Trial | null> => {
  const { ready } = await getProSettings();
  if (!ready || !designerId) return null;
  const { data, error } = await createAdminClient().from("pro_trials").select(TRIAL_COLUMNS).eq("designer_id", designerId).maybeSingle();
  return !error && data ? toTrial(data as Record<string, unknown>) : null;
});

/** "pro" (a paid or given plan), "trial" (the free Pro Trial), or null (Basic). */
export const proKind = cache(async (designerId: string | null | undefined): Promise<"pro" | "trial" | null> => {
  if (!designerId) return null;
  if (isProActive(await getSubscription(designerId))) return "pro";
  return isTrialActive(await getTrial(designerId)) ? "trial" : null;
});

/**
 * isPro(designer): Pro features are on, from a plan whose period has not ended or from a running free trial (owner,
 * 2026-10-14). Every Pro check goes here; the trial's own limits are applied where they differ (checks, portfolio).
 */
export const isPro = cache(async (designerId: string | null | undefined): Promise<boolean> => (await proKind(designerId)) !== null);

/** Designers on a running free trial, among these (not the ones who also have a plan). */
async function trialIds(ids: string[] | null): Promise<string[]> {
  let q = createAdminClient().from("pro_trials").select("designer_id").eq("status", "active").gt("ends_at", new Date().toISOString());
  if (ids) q = q.in("designer_id", ids);
  const { data, error } = await q;
  return error ? [] : (data ?? []).map((r) => r.designer_id as string);
}

async function paidIdsAmong(unique: string[]): Promise<Set<string>> {
  const { data } = await createAdminClient().from("pro_subscriptions").select("designer_id").in("designer_id", unique).neq("status", "expired").gt("current_period_end", new Date().toISOString());
  return new Set((data ?? []).map((r) => r.designer_id as string));
}

/** Which of these designers have Pro right now, from a plan or a free trial (badges, highlighted entries, lists). */
export async function proIdsAmong(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const { ready } = await getProSettings();
  if (!ready || !unique.length) return new Set();
  const [paid, trial] = await Promise.all([paidIdsAmong(unique), trialIds(unique)]);
  return new Set([...paid, ...trial]);
}

/** Of these designers, the ones whose Pro is the free trial (their badge reads "PRO TRIAL"). */
export async function trialIdsAmong(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const { ready } = await getProSettings();
  if (!ready || !unique.length) return new Set();
  const [paid, trial] = await Promise.all([paidIdsAmong(unique), trialIds(unique)]);
  return new Set(trial.filter((id) => !paid.has(id)));
}

/** Every designer who has Pro right now (plan or free trial). */
export async function allProIds(): Promise<string[]> {
  const { ready } = await getProSettings();
  if (!ready) return [];
  const [{ data }, trial] = await Promise.all([createAdminClient().from("pro_subscriptions").select("designer_id").neq("status", "expired").gt("current_period_end", new Date().toISOString()), trialIds(null)]);
  return [...new Set([...(data ?? []).map((r) => r.designer_id as string), ...trial])];
}

/** Pro designers who show the Pro badge (the badge can be hidden in Settings › Pro extras). */
export async function badgeIdsAmong(ids: string[]): Promise<Set<string>> {
  const pro = await proIdsAmong(ids);
  if (!pro.size) return pro;
  const { data } = await createAdminClient().from("pro_preferences").select("designer_id").in("designer_id", [...pro]).eq("show_badge", false);
  for (const r of data ?? []) pro.delete(r.designer_id as string);
  return pro;
}
