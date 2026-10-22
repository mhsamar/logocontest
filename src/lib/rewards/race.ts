import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rankClients,
  rankDesigners,
  type ClientStanding,
  type DesignerStanding,
  type RaceContest,
  type RaceEntry,
  type RacePayment,
  type RacePerson,
  type RaceWin,
  visitsAbroad,
} from "./race-rules";
import { monthRange } from "./rules";

/** Who a standing belongs to, for display. Public pages show only the name and photo. */
export type RaceProfile = { id: string; name: string; username: string | null; businessName: string | null; avatarUrl: string | null };

export type MonthRace = {
  month: string;
  clients: (ClientStanding & { profile: RaceProfile })[];
  designers: (DesignerStanding & { profile: RaceProfile })[];
  /** The leaderboard's counts for the month (only people in the race). */
  counts: { contestsPosted: number; clientsInRace: number; contestsWon: number; designersWithWin: number };
};

const EMPTY = (month: string): MonthRace => ({ month, clients: [], designers: [], counts: { contestsPosted: 0, clientsInRace: 0, contestsWon: 0, designersWithWin: 0 } });

/**
 * The month's race from the database (BLUEPRINT §11, owner 2026-10-11). `testMode` counts only test accounts
 * (for trying the month close without touching real people).
 */
export async function monthRace(month: string, opts: { testMode?: boolean } = {}): Promise<MonthRace> {
  if (!isSupabaseConfigured()) return EMPTY(month);
  const testMode = Boolean(opts.testMode);
  const { start, end } = monthRange(month);
  const from = start.toISOString();
  const to = end.toISOString();
  const db = createAdminClient();

  const [contestsRes, winsRes] = await Promise.all([
    db.from("contests").select("id, client_id, prize_amount, starts_at, status").gte("starts_at", from).lt("starts_at", to),
    db.from("handovers").select("contest_id, designer_id, prize, fee_rate, created_at, status").gte("created_at", from).lt("created_at", to),
  ]);
  if (contestsRes.error) throw new Error(contestsRes.error.message);
  if (winsRes.error) throw new Error(winsRes.error.message);
  const contestRows = contestsRes.data ?? [];
  const winRows = winsRes.data ?? [];

  const contestIds = contestRows.map((c) => c.id as string);
  const clientIds = [...new Set(contestRows.map((c) => c.client_id as string))];
  const designerIds = [...new Set(winRows.map((w) => w.designer_id as string))];
  // Contests with a money-back claim (owner, 2026-10-21): left out of the client race. Before migration 0069: none.
  const { data: claimRows } = contestIds.length ? await db.from("guarantee_claims").select("contest_id").in("contest_id", contestIds).in("status", ["pending", "approved", "refunded"]) : { data: [] };
  const moneyBack = new Set((claimRows ?? []).map((r) => r.contest_id as string));
  const [paidRes, paymentsRes, entriesRes, peopleRes] = await Promise.all([
    contestIds.length ? db.from("payments").select("contest_id").eq("purpose", "contest").eq("status", "paid").in("contest_id", contestIds) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? db.from("payments").select("client_id, amount, paid_at").eq("status", "paid").in("client_id", clientIds).gte("paid_at", from).lt("paid_at", to) : Promise.resolve({ data: [], error: null }),
    designerIds.length ? db.from("entries").select("contest_id, designer_id, created_at, status").in("designer_id", designerIds).gte("created_at", from).lt("created_at", to) : Promise.resolve({ data: [], error: null }),
    clientIds.length + designerIds.length
      ? db.from("profiles").select("id, role, status, is_test, name, username, business_name, avatar_path").in("id", [...clientIds, ...designerIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [paidRes, paymentsRes, entriesRes, peopleRes]) if (r.error) throw new Error(r.error.message);

  const paid = new Set((paidRes.data ?? []).map((p) => p.contest_id as string));
  // Where each person visited from this month (owner, 2026-10-14: the prizes are for Bangladesh only). Before
  // migration 0051 the function is missing and everyone counts, as before.
  const visits = new Map<string, { bd: number; abroad: number }>();
  const allIds = [...clientIds, ...designerIds];
  if (allIds.length) {
    const { data: v } = await db.rpc("visit_countries", { p_user_ids: allIds, p_from: from, p_to: to });
    for (const r of (v ?? []) as { user_id: string; bd_views: number; abroad_views: number }[]) visits.set(r.user_id, { bd: Number(r.bd_views), abroad: Number(r.abroad_views) });
  }
  const people = new Map<string, RacePerson>();
  const profiles = new Map<string, RaceProfile>();
  for (const p of peopleRes.data ?? []) {
    people.set(p.id as string, { id: p.id as string, role: p.role as RacePerson["role"], status: p.status as string, isTest: Boolean(p.is_test), abroad: visitsAbroad(visits.get(p.id as string)) });
    profiles.set(p.id as string, {
      id: p.id as string,
      name: (p.name as string) ?? "",
      username: (p.username as string | null) ?? null,
      businessName: (p.business_name as string | null) ?? null,
      avatarUrl: avatarUrl(p.avatar_path as string | null),
    });
  }

  const contests: RaceContest[] = contestRows.map((c) => ({
    contestId: c.id as string,
    clientId: c.client_id as string,
    prize: c.prize_amount as number,
    startsAt: new Date(c.starts_at as string),
    status: c.status as string,
    paid: paid.has(c.id as string),
    moneyBack: moneyBack.has(c.id as string),
  }));
  const payments: RacePayment[] = (paymentsRes.data ?? []).map((p) => ({ clientId: p.client_id as string, amount: p.amount as number, paidAt: new Date(p.paid_at as string) }));
  const wins: RaceWin[] = winRows.map((w) => ({
    contestId: w.contest_id as string,
    designerId: w.designer_id as string,
    prize: w.prize as number,
    feeRate: w.fee_rate as number,
    pickedAt: new Date(w.created_at as string),
    status: w.status as string,
  }));
  const entries: RaceEntry[] = (entriesRes.data ?? []).map((e) => ({ contestId: e.contest_id as string, designerId: e.designer_id as string, createdAt: new Date(e.created_at as string), status: e.status as string }));

  const clients = rankClients(month, contests, payments, people, testMode);
  const designers = rankDesigners(month, wins, entries, people, testMode);
  const unknown: RaceProfile = { id: "", name: "", username: null, businessName: null, avatarUrl: null };
  return {
    month,
    clients: clients.map((c) => ({ ...c, profile: profiles.get(c.id) ?? { ...unknown, id: c.id } })),
    designers: designers.map((d) => ({ ...d, profile: profiles.get(d.id) ?? { ...unknown, id: d.id } })),
    counts: {
      contestsPosted: clients.reduce((n, c) => n + c.contests, 0),
      clientsInRace: clients.length,
      contestsWon: designers.reduce((n, d) => n + d.wins, 0),
      designersWithWin: designers.length,
    },
  };
}
