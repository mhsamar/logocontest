import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { refundsIn } from "@/lib/guarantee/queries";
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
  /** Visits that reached each wizard step (1–8), went to payment (9) and paid (10). Owner, 2026-10-15: 8 steps. */
  funnel: { step: number; visits: number }[];
  /** The new 4-step wizard's funnel (owner, 2026-10-29); null when nobody used it in the period (always before migration 0079). */
  v2Funnel: V2FunnelStep[] | null;
  recent: { action: string; subjectType: string; admin: string | null; createdAt: Date }[];
};

const LIVE_OR_LATER = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];
// A column a migration adds, read before that migration has run.
const NO_COLUMN = /PGRST204|42703/;
type Db = ReturnType<typeof createAdminClient>;

/** Onboarding v2's funnel, in order (client-onboarding-v2-spec.md §4; texts wizardV2.admin.funnel.*). */
export const V2_FUNNEL = ["started", "account", "basics", "viewed", "picked", "sent", "approved"] as const;
export type V2FunnelStep = { key: (typeof V2_FUNNEL)[number]; count: number; /** % of the step before; null on the first step or after an empty one. */ ofBefore: number | null };

type V2Visit = { furthest_step: unknown; contest_id?: unknown };
type V2Contest = { id: string; status: string; last_step?: unknown; pricing_viewed_at: unknown; package_selected_at: unknown };

/**
 * From the new wizard's visits (1 account … 5 payment sent) and the contests it made, in a period: opened step 1, made
 * an account, gave the logo name (the contest is saved there), saw the prizes, picked a package, sent the bKash payment
 * (waiting or approved), approved. Null when there is neither a visit nor a contest.
 *
 * Each tab is a visit of its own, so the visits on one contest count once (the furthest of them). A contest's steps
 * count on: one that went on to pay the package shown picked it, and saw the prizes, even without a tap on a card.
 */
export function v2FunnelOf(visits: V2Visit[], contests: V2Contest[], sent: Set<string>): V2FunnelStep[] | null {
  if (!visits.length && !contests.length) return null;
  const steps: number[] = [];
  const onContest = new Map<string, number>();
  for (const v of visits) {
    const step = Number(v.furthest_step) || 0;
    if (v.contest_id) onContest.set(String(v.contest_id), Math.max(onContest.get(String(v.contest_id)) ?? 0, step));
    else steps.push(step);
  }
  steps.push(...onContest.values());
  const approved = (c: V2Contest) => LIVE_OR_LATER.includes(c.status);
  const paid = (c: V2Contest) => sent.has(c.id) || approved(c);
  const picked = (c: V2Contest) => Boolean(c.package_selected_at) || Number(c.last_step) >= 4 || c.status === "pending_payment" || paid(c);
  const viewed = (c: V2Contest) => Boolean(c.pricing_viewed_at) || Number(c.last_step) >= 3 || picked(c);
  const counts = [
    steps.length,
    steps.filter((s) => s >= 2).length,
    contests.length,
    contests.filter(viewed).length,
    contests.filter(picked).length,
    contests.filter(paid).length,
    contests.filter(approved).length,
  ];
  return V2_FUNNEL.map((key, i) => ({ key, count: counts[i], ofBefore: i > 0 && counts[i - 1] > 0 ? Math.round((counts[i] / counts[i - 1]) * 100) : null }));
}

/** Wizard visits in a period, with the wizard each was (migration 0079); before that migration, all the old one's. */
async function visitsIn(db: Db, since: string, until: string) {
  const read = (flow: boolean) => db.from("wizard_visits").select((flow ? "furthest_step, contest_id, flow" : "furthest_step, contest_id") as "furthest_step, contest_id, flow").gte("created_at", since).lt("created_at", until).limit(20000);
  const first = await read(true);
  return first.error && NO_COLUMN.test(`${first.error.code}`) ? read(false) : first;
}

const chunks = (ids: string[]) => Array.from({ length: Math.ceil(ids.length / 150) }, (_, i) => ids.slice(i * 150, (i + 1) * 150));

/** The new wizard's funnel for a period (none before migration 0079: its columns are missing, and every visit is the old wizard's). */
async function v2Funnel(db: Db, visits: V2Visit[], since: string, until: string): Promise<V2FunnelStep[] | null> {
  const { data, error } = await db.from("contests").select("id, status, last_step, pricing_viewed_at, package_selected_at").not("brief_completion", "is", null).gte("created_at", since).lt("created_at", until).limit(5000);
  const contests = error ? [] : ((data ?? []) as V2Contest[]);
  const ids = contests.map((c) => c.id);
  // A visit in the period to a contest made before it (a resume link, a signed-in return) is no new start.
  const made = new Set(ids);
  const others = [...new Set(visits.map((v) => (v.contest_id ? String(v.contest_id) : "")).filter((id) => id && !made.has(id)))];
  const [proofs, older] = await Promise.all([
    Promise.all(chunks(ids).map((part) => db.from("manual_payments").select("contest_id").eq("kind", "contest").in("status", ["pending", "approved"]).in("contest_id", part))),
    Promise.all(chunks(others).map((part) => db.from("contests").select("id").in("id", part).lt("created_at", since))),
  ]);
  const sent = new Set(proofs.flatMap((p) => (p.data ?? []).map((m) => m.contest_id as string)));
  const before = new Set(older.flatMap((r) => (r.data ?? []).map((c) => c.id as string)));
  return v2FunnelOf(visits.filter((v) => !v.contest_id || !before.has(String(v.contest_id))), contests, sent);
}

/** The period the dashboard counts: from `since` (null = all time) up to `until` (null = now). */
export type StatsPeriod = { since: Date | null; until: Date | null };

export type PeriodMoney = { clientPayments: number; paymentsCount: number; serviceFees: number; addons: number; designerFees: number; /** Sent back under the money-back guarantee (owner, 2026-10-21), already taken off the rest. */ refunded: number };

/** Money in a period: what clients paid, and our part of it (service fees, add-ons, the designers' win fees). */
export async function periodMoney(period: StatsPeriod): Promise<PeriodMoney> {
  const out: PeriodMoney = { clientPayments: 0, paymentsCount: 0, serviceFees: 0, addons: 0, designerFees: 0, refunded: 0 };
  if (!isSupabaseConfigured()) return out;
  const db = createAdminClient();
  const since = period.since ? period.since.toISOString() : "1970-01-01T00:00:00Z";
  const until = (period.until ?? new Date(Date.now() + 86_400_000)).toISOString();
  const [payments, fees, back] = await Promise.all([
    db.from("payments").select("amount, purpose, contest:contests!contest_id(service_fee_amount, upgrades_amount)").eq("status", "paid").gte("paid_at", since).lt("paid_at", until).limit(10000),
    db.from("wallet_transactions").select("fee_amount").in("type", ["prize_credit", "split_share"]).gte("created_at", since).lt("created_at", until).limit(10000),
    refundsIn(since, until),
  ]);
  for (const p of payments.data ?? []) {
    out.clientPayments += p.amount as number;
    out.paymentsCount += 1;
    if (p.purpose === "contest") {
      const c = one(p.contest as { service_fee_amount: number; upgrades_amount: number } | { service_fee_amount: number; upgrades_amount: number }[] | null);
      out.serviceFees += c?.service_fee_amount ?? 0;
      out.addons += c?.upgrades_amount ?? 0;
    } else {
      out.addons += p.amount as number; // extensions and add-ons bought later go to the platform in full
    }
  }
  out.designerFees = (fees.data ?? []).reduce((s, r) => s + ((r.fee_amount as number | null) ?? 0), 0);
  // Money-back refunds come off in the period the money went back.
  out.refunded = back.amount;
  out.clientPayments -= back.amount;
  out.serviceFees -= back.fees;
  out.addons -= back.extras;
  return out;
}

export async function dashboardStats(period: StatsPeriod): Promise<DashboardStats | null> {
  if (!isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const since = period.since ? period.since.toISOString() : "1970-01-01T00:00:00Z";
  const until = (period.until ?? new Date(Date.now() + 86_400_000)).toISOString();
  const head = { count: "exact" as const, head: true };

  const [posted, live, completed, money, finished, withdrawals, reports, claims, visits, recent] = await Promise.all([
    db.from("contests").select("id", head).in("status", LIVE_OR_LATER).gte("starts_at", since).lt("starts_at", until),
    db.from("contests").select("id", head).eq("status", "open"),
    db.from("contests").select("id", head).eq("status", "completed").gte("completed_at", since).lt("completed_at", until),
    periodMoney(period),
    db.from("contests").select("id").in("status", ["judging", "winner_selected", "handover", "completed", "no_result"]).gte("starts_at", since).lt("starts_at", until).limit(5000),
    db.from("withdrawals").select("amount").eq("status", "requested"),
    db.from("reports").select("id", head).eq("status", "open"),
    db.from("copy_claims").select("id", head).eq("status", "open"),
    visitsIn(db, since, until),
    db.from("audit_logs").select("action, subject_type, created_at, admin:profiles!admin_id(name)").order("created_at", { ascending: false }).limit(8),
  ]);

  const { serviceFees, addons, designerFees, clientPayments, paymentsCount } = money;

  const finishedIds = (finished.data ?? []).map((c) => c.id as string);
  let avgEntries: number | null = null;
  if (finishedIds.length) {
    const { count } = await db.from("entries").select("id", head).in("contest_id", finishedIds);
    avgEntries = Math.round(((count ?? 0) / finishedIds.length) * 10) / 10;
  }

  // The drop-off chart counts the old wizard's visits only, so it keeps its meaning; the new one has its own funnel.
  const rows = (visits.data ?? []).filter((v) => (v.flow ?? "v1") === "v1");
  const draftIds = [...new Set(rows.map((v) => v.contest_id as string | null).filter((x): x is string => Boolean(x)))];
  const paid = new Set<string>();
  if (draftIds.length) {
    const { data } = await db.from("contests").select("id").in("id", draftIds).in("status", LIVE_OR_LATER);
    for (const c of data ?? []) paid.add(c.id as string);
  }
  const funnel = Array.from({ length: 9 }, (_, i) => ({ step: i + 1, visits: rows.filter((v) => (v.furthest_step as number) >= i + 1).length }));
  funnel.push({ step: 10, visits: rows.filter((v) => v.contest_id && paid.has(v.contest_id as string)).length });
  const v2 = await v2Funnel(db, (visits.data ?? []).filter((v) => v.flow === "v2"), since, until);

  return {
    contestsPosted: posted.count ?? 0,
    contestsLive: live.count ?? 0,
    contestsCompleted: completed.count ?? 0,
    clientPayments,
    paymentsCount,
    revenue: { serviceFees, addons, designerFees, total: serviceFees + addons + designerFees },
    avgEntries,
    pendingWithdrawals: { count: withdrawals.data?.length ?? 0, amount: (withdrawals.data ?? []).reduce((s, w) => s + (w.amount as number), 0) },
    openReports: reports.count ?? 0,
    openClaims: claims.count ?? 0,
    funnel,
    v2Funnel: v2,
    recent: (recent.data ?? []).map((r) => ({
      action: r.action as string,
      subjectType: r.subject_type as string,
      admin: one(r.admin as { name: string } | { name: string }[] | null)?.name ?? null,
      createdAt: new Date(r.created_at as string),
    })),
  };
}
