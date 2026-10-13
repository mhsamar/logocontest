import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { toTrial, TRIAL_COLUMNS, type Trial } from "./status";

/**
 * Admin › Pro plan › Pro Trials (owner, 2026-10-14): every trial with its dates, status, what it used (logo checks,
 * portfolio images), the upgrade payment, the reminder history, and the numbers at the top. Real data only.
 */

const db = () => createAdminClient();

export type TrialEvent = { kind: "started" | "reminded" | "extended" | "cancelled" | "expired" | "upgraded"; at: string; byAdmin: boolean; detail: Record<string, unknown> | null };

export type AdminTrialRow = Trial & {
  designer: { id: string; name: string; username: string | null };
  checksUsed: number;
  portfolioUploads: number;
  payment: { status: "paid" | "pending" | "failed"; amount: number } | null;
  events: TrialEvent[];
};

export type TrialOverview = { rows: AdminTrialRow[]; active: number; upgraded: number; ended: number; rate: number | null };

/** The end of what a trial counts: its end, or when it stopped early. */
const until = (t: Trial) => (t.endedAt && t.endedAt < t.endsAt ? t.endedAt : t.endsAt);
const within = (iso: string, t: Trial) => {
  const at = new Date(iso).getTime();
  return at >= t.startedAt.getTime() && at < until(t).getTime();
};

export async function trialOverview(limit = 200): Promise<TrialOverview> {
  const { data, error } = await db().from("pro_trials").select(`${TRIAL_COLUMNS}, designer:profiles!designer_id(id, name, username)`).order("started_at", { ascending: false }).limit(limit);
  if (error) return { rows: [], active: 0, upgraded: 0, ended: 0, rate: null };
  const raw = (data ?? []) as unknown as Record<string, unknown>[];
  const trials = raw.map((r) => ({ t: toTrial(r), d: (Array.isArray(r.designer) ? r.designer[0] : r.designer) as { id: string; name: string; username: string | null } | null }));
  const ids = trials.map((x) => x.t.designerId);
  const tids = trials.map((x) => x.t.id);
  const since = trials.length ? new Date(Math.min(...trials.map((x) => x.t.startedAt.getTime()))).toISOString() : new Date().toISOString();
  const [checks, items, payments, events] = ids.length
    ? await Promise.all([
        db().from("logo_checks").select("requested_by, created_at").in("requested_by", ids).in("source", ["designer", "pre_submit"]).neq("status", "failed").gte("created_at", since),
        db().from("portfolio_items").select("designer_id, created_at").in("designer_id", ids).gte("created_at", since),
        db().from("pro_payments").select("id, designer_id, status, amount_bdt, created_at").in("designer_id", ids).gte("created_at", since).order("created_at", { ascending: false }),
        db().from("pro_trial_events").select("trial_id, kind, actor_id, designer_id, detail, created_at").in("trial_id", tids).order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const rows: AdminTrialRow[] = trials.map(({ t, d }) => {
    const pays = (payments.data ?? []).filter((p) => p.designer_id === t.designerId);
    const linked = t.upgradePaymentId ? pays.find((p) => p.id === t.upgradePaymentId) : null;
    // The upgrade payment, or the newest payment made after the trial started.
    const p = linked ?? pays.find((x) => new Date(x.created_at as string) >= t.startedAt) ?? null;
    return {
      ...t,
      designer: d ?? { id: t.designerId, name: "—", username: null },
      checksUsed: (checks.data ?? []).filter((c) => c.requested_by === t.designerId && within(c.created_at as string, t)).length,
      portfolioUploads: (items.data ?? []).filter((i) => i.designer_id === t.designerId && within(i.created_at as string, t)).length,
      payment: p ? { status: (p.status === "paid" ? "paid" : p.status === "failed" ? "failed" : "pending") as "paid" | "pending" | "failed", amount: p.amount_bdt as number } : null,
      events: (events.data ?? [])
        .filter((e) => e.trial_id === t.id)
        .map((e) => ({ kind: e.kind as TrialEvent["kind"], at: e.created_at as string, byAdmin: !!e.actor_id && e.actor_id !== e.designer_id, detail: (e.detail as Record<string, unknown> | null) ?? null })),
    };
  });
  const active = rows.filter((r) => r.status === "active" && r.endsAt > new Date()).length;
  const upgraded = rows.filter((r) => r.status === "upgraded").length;
  const ended = rows.filter((r) => r.status === "expired" || r.status === "cancelled").length;
  return { rows, active, upgraded, ended, rate: upgraded + ended > 0 ? Math.round((upgraded / (upgraded + ended)) * 100) : null };
}
