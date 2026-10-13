import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProActive, type SubStatus } from "./rules";
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

/** isPro(designer): an active subscription whose period has not ended (server rule; every Pro check goes here). */
export const isPro = cache(async (designerId: string | null | undefined): Promise<boolean> => {
  if (!designerId) return false;
  return isProActive(await getSubscription(designerId));
});

/** Which of these designers are Pro right now (for badges and highlighted entries in lists). */
export async function proIdsAmong(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const { ready } = await getProSettings();
  if (!ready || !unique.length) return new Set();
  const { data } = await createAdminClient().from("pro_subscriptions").select("designer_id, status, current_period_end").in("designer_id", unique).neq("status", "expired").gt("current_period_end", new Date().toISOString());
  return new Set((data ?? []).map((r) => r.designer_id as string));
}

/** Every designer who is Pro right now. */
export async function allProIds(): Promise<string[]> {
  const { ready } = await getProSettings();
  if (!ready) return [];
  const { data } = await createAdminClient().from("pro_subscriptions").select("designer_id").neq("status", "expired").gt("current_period_end", new Date().toISOString());
  return (data ?? []).map((r) => r.designer_id as string);
}

/** Pro designers who show the Pro badge (the badge can be hidden in Settings › Pro extras). */
export async function badgeIdsAmong(ids: string[]): Promise<Set<string>> {
  const pro = await proIdsAmong(ids);
  if (!pro.size) return pro;
  const { data } = await createAdminClient().from("pro_preferences").select("designer_id").in("designer_id", [...pro]).eq("show_badge", false);
  for (const r of data ?? []) pro.delete(r.designer_id as string);
  return pro;
}
