import "server-only";
import { dhakaMonth } from "@/lib/pro/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkerRates, toBdt, type CheckerRates } from "./costs";

/**
 * Admin › Copyright checker › Cost report (owner, 2026-10-14): what every logo check cost in API calls, in taka,
 * per check, per contest and per month. Checks made before the report kept only a USD cost; those are shown in taka
 * at today's rate. Real data only.
 */

const db = () => createAdminClient();
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type CostRow = {
  id: string;
  number: number;
  at: string;
  status: "queued" | "running" | "done" | "failed";
  /** client: a client's check; designer: a designer's own check or check before sending. */
  kind: "client" | "designer";
  who: { id: string; name: string };
  contest: { id: string; slug: string; brand: string; number: number | null } | null;
  costUsd: number;
  costBdt: number;
  /** The taka cost was worked out today (an older check that kept only USD). */
  estimated: boolean;
};

export type CostReport = {
  month: { key: string; label: Date; from: Date; to: Date };
  rows: CostRow[];
  totals: { checks: number; done: number; failed: number; bdt: number; usd: number; avgBdt: number };
  byContest: { id: string; slug: string; brand: string; number: number | null; client: string; checks: number; bdt: number }[];
  byMonth: { key: string; checks: number; bdt: number }[];
  rates: CheckerRates;
};

/** "2026-10" → that Bangladesh month; anything else → this month. */
export function monthFromKey(key: string | null | undefined, now: Date = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  const at = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15)) : now;
  const dm = dhakaMonth(at);
  return { key: dm.key.slice(0, 7), label: new Date(dm.key), from: dm.from, to: dm.to };
}

const COLUMNS =
  "id, number, created_at, status, source, cost_usd, cost_bdt, requester:profiles!requested_by(id, name), contest:contests!contest_id(id, slug, brand_name, contest_number, client:profiles!client_id(id, name))";

function toRow(r: Record<string, unknown>, rates: CheckerRates): CostRow {
  const c = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null } | null);
  const who = one(r.requester as { id: string; name: string } | null) ?? { id: "", name: "—" };
  const usd = Number(r.cost_usd) || 0;
  const bdt = r.cost_bdt === null || r.cost_bdt === undefined ? null : Number(r.cost_bdt);
  return {
    id: r.id as string,
    number: r.number as number,
    at: r.created_at as string,
    status: r.status as CostRow["status"],
    kind: r.source === "entry" || r.source === "upload" ? "client" : "designer",
    who,
    contest: c ? { id: c.id, slug: c.slug, brand: c.brand_name, number: c.contest_number } : null,
    costUsd: usd,
    costBdt: bdt ?? toBdt(usd, rates),
    estimated: bdt === null,
  };
}

export async function costReport(monthKey: string | null): Promise<CostReport> {
  const rates = await checkerRates();
  const month = monthFromKey(monthKey);
  const yearAgo = monthFromKey(null, new Date(month.from.getTime() - 330 * 86_400_000));
  const [{ data }, { data: history }] = await Promise.all([
    db().from("logo_checks").select(COLUMNS).gte("created_at", month.from.toISOString()).lt("created_at", month.to.toISOString()).order("created_at", { ascending: false }).limit(5000),
    db().from("logo_checks").select("created_at, cost_usd, cost_bdt").gte("created_at", yearAgo.from.toISOString()).lt("created_at", month.to.toISOString()).limit(50000),
  ]);
  const raw = (data ?? []) as unknown as Record<string, unknown>[];
  const rows = raw.map((r) => toRow(r, rates));

  const byContest = new Map<string, CostReport["byContest"][number]>();
  for (const [i, r] of rows.entries()) {
    if (!r.contest) continue;
    const client = one(one(raw[i].contest as { client: unknown } | null)?.client as { name: string } | null)?.name ?? "—";
    const cur = byContest.get(r.contest.id) ?? { ...r.contest, client, checks: 0, bdt: 0 };
    cur.checks += 1;
    cur.bdt += r.costBdt;
    byContest.set(r.contest.id, cur);
  }

  const byMonth = new Map<string, { key: string; checks: number; bdt: number }>();
  for (const h of history ?? []) {
    const key = dhakaMonth(new Date(h.created_at as string)).key.slice(0, 7);
    const cur = byMonth.get(key) ?? { key, checks: 0, bdt: 0 };
    cur.checks += 1;
    cur.bdt += h.cost_bdt === null ? toBdt(Number(h.cost_usd) || 0, rates) : Number(h.cost_bdt);
    byMonth.set(key, cur);
  }

  const bdt = rows.reduce((a, r) => a + r.costBdt, 0);
  return {
    month,
    rows,
    totals: {
      checks: rows.length,
      done: rows.filter((r) => r.status === "done").length,
      failed: rows.filter((r) => r.status === "failed").length,
      bdt: Math.round(bdt * 100) / 100,
      usd: Math.round(rows.reduce((a, r) => a + r.costUsd, 0) * 10000) / 10000,
      avgBdt: rows.length ? Math.round((bdt / rows.length) * 100) / 100 : 0,
    },
    byContest: [...byContest.values()].map((c) => ({ ...c, bdt: Math.round(c.bdt * 100) / 100 })).sort((a, b) => b.bdt - a.bdt),
    byMonth: [...byMonth.values()].map((m) => ({ ...m, bdt: Math.round(m.bdt * 100) / 100 })).sort((a, b) => b.key.localeCompare(a.key)),
    rates,
  };
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** The CSV download: one row per check of the month. */
export function costCsv(report: CostReport): string {
  const head = ["when (Dhaka)", "check", "status", "who", "role", "user id", "contest", "contest id", "cost BDT", "cost USD", "BDT worked out today"];
  const dhaka = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().replace("T", " ").slice(0, 16);
  const lines = report.rows.map((r) =>
    [
      dhaka(r.at),
      `CC-${String(r.number).padStart(4, "0")}`,
      r.status,
      r.who.name,
      r.kind,
      r.who.id,
      r.contest?.brand ?? "",
      r.contest?.number ? `LC-${String(r.contest.number).padStart(4, "0")}` : "",
      r.costBdt.toFixed(2),
      r.costUsd.toFixed(4),
      r.estimated ? "yes" : "no",
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.map(csvCell).join(","), ...lines].join("\n");
}
