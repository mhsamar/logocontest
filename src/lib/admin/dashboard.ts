import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** A-01 Dashboard (BLUEPRINT §13.1). Small volumes for now, so totals are summed here rather than in SQL. */
export type DashboardStats = {
  contestsPosted: number;
  contestsLive: number;
  contestsCompleted: number;
  clientPayments: number;
  paymentsCount: number;
  revenue: { serviceFees: number; addons: number; designerFees: number; total: number };
  avgEntries: number | null;
  pendingWithdrawals: { count: number; amount: number };
  openReports: number;
  openClaims: number;
  /** Visits that reached each wizard step (1–11), went to payment (12) and paid (13). */
  funnel: { step: number; visits: number }[];
  recent: { action: string; subjectType: string; admin: string | null; createdAt: Date }[];
};

const LIVE_OR_LATER = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

/** The period the dashboard counts: from `since` (null = all time) up to `until` (null = now). */
export type StatsPeriod = { since: Date | null; until: Date | null };

export async function dashboardStats(period: StatsPeriod): Promise<DashboardStats | null> {
  if (!isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const since = period.since ? period.since.toISOString() : "1970-01-01T00:00:00Z";
  const until = (period.until ?? new Date(Date.now() + 86_400_000)).toISOString();
  const head = { count: "exact" as const, head: true };

  const [posted, live, completed, payments, fees, finished, withdrawals, reports, claims, visits, recent] = await Promise.all([
    db.from("contests").select("id", head).in("status", LIVE_OR_LATER).gte("starts_at", since).lt("starts_at", until),
    db.from("contests").select("id", head).eq("status", "open"),
    db.from("contests").select("id", head).eq("status", "completed").gte("completed_at", since).lt("completed_at", until),
    db.from("payments").select("amount, purpose, contest:contests!contest_id(service_fee_amount, upgrades_amount)").eq("status", "paid").gte("paid_at", since).lt("paid_at", until).limit(10000),
    db.from("wallet_transactions").select("fee_amount").in("type", ["prize_credit", "split_share"]).gte("created_at", since).lt("created_at", until).limit(10000),
    db.from("contests").select("id").in("status", ["judging", "winner_selected", "handover", "completed", "no_result"]).gte("starts_at", since).lt("starts_at", until).limit(5000),
    db.from("withdrawals").select("amount").eq("status", "requested"),
    db.from("reports").select("id", head).eq("status", "open"),
    db.from("copy_claims").select("id", head).eq("status", "open"),
    db.from("wizard_visits").select("furthest_step, contest_id").gte("created_at", since).lt("created_at", until).limit(20000),
    db.from("audit_logs").select("action, subject_type, created_at, admin:profiles!admin_id(name)").order("created_at", { ascending: false }).limit(8),
  ]);

  let serviceFees = 0;
  let addons = 0;
  let clientPayments = 0;
  for (const p of payments.data ?? []) {
    clientPayments += p.amount as number;
    if (p.purpose === "contest") {
      const c = one(p.contest as { service_fee_amount: number; upgrades_amount: number } | { service_fee_amount: number; upgrades_amount: number }[] | null);
      serviceFees += c?.service_fee_amount ?? 0;
      addons += c?.upgrades_amount ?? 0;
    } else {
      addons += p.amount as number; // extensions and add-ons bought later go to the platform in full
    }
  }
  const designerFees = (fees.data ?? []).reduce((s, r) => s + ((r.fee_amount as number | null) ?? 0), 0);

  const finishedIds = (finished.data ?? []).map((c) => c.id as string);
  let avgEntries: number | null = null;
  if (finishedIds.length) {
    const { count } = await db.from("entries").select("id", head).in("contest_id", finishedIds);
    avgEntries = Math.round(((count ?? 0) / finishedIds.length) * 10) / 10;
  }

  const rows = visits.data ?? [];
  const draftIds = [...new Set(rows.map((v) => v.contest_id as string | null).filter((x): x is string => Boolean(x)))];
  const paid = new Set<string>();
  if (draftIds.length) {
    const { data } = await db.from("contests").select("id").in("id", draftIds).in("status", LIVE_OR_LATER);
    for (const c of data ?? []) paid.add(c.id as string);
  }
  const funnel = Array.from({ length: 12 }, (_, i) => ({ step: i + 1, visits: rows.filter((v) => (v.furthest_step as number) >= i + 1).length }));
  funnel.push({ step: 13, visits: rows.filter((v) => v.contest_id && paid.has(v.contest_id as string)).length });

  return {
    contestsPosted: posted.count ?? 0,
    contestsLive: live.count ?? 0,
    contestsCompleted: completed.count ?? 0,
    clientPayments,
    paymentsCount: payments.data?.length ?? 0,
    revenue: { serviceFees, addons, designerFees, total: serviceFees + addons + designerFees },
    avgEntries,
    pendingWithdrawals: { count: withdrawals.data?.length ?? 0, amount: (withdrawals.data ?? []).reduce((s, w) => s + (w.amount as number), 0) },
    openReports: reports.count ?? 0,
    openClaims: claims.count ?? 0,
    funnel,
    recent: (recent.data ?? []).map((r) => ({
      action: r.action as string,
      subjectType: r.subject_type as string,
      admin: one(r.admin as { name: string } | { name: string }[] | null)?.name ?? null,
      createdAt: new Date(r.created_at as string),
    })),
  };
}
