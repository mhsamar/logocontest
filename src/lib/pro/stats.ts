import "server-only";
import { GONE_STATUSES } from "@/lib/entries/rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { winRate } from "./rules";

export type DesignerStats = {
  wins: number;
  contests: number;
  entries: number;
  winRate: number;
  rating: number | null;
  rated: number;
  shortlists: number;
  /** Wins per business type (logo contests) or service (other kinds). */
  winsByType: Map<string, number>;
  /** Business types / services of the contests joined, most first. */
  types: string[];
  replyMinutes: number | null;
};

const empty = (): DesignerStats => ({ wins: 0, contests: 0, entries: 0, winRate: 0, rating: null, rated: 0, shortlists: 0, winsByType: new Map(), types: [], replyMinutes: null });

/**
 * Real numbers for many designers at once (invites ranking, quality score, Admin › Pro plan): wins, contests joined,
 * win rate, client rating (stars on their designs), shortlists, wins per design type and reply time in contest chat.
 * Same rules as the public profile; nothing is made up, and a designer with no data gets zeros / null.
 */
export async function designerStatsBulk(ids: string[]): Promise<Map<string, DesignerStats>> {
  const out = new Map<string, DesignerStats>(ids.map((id) => [id, empty()]));
  if (!ids.length) return out;
  const db = createAdminClient();
  const [{ data: entries }, { data: profiles }, { data: msgs }] = await Promise.all([
    db
      .from("entries")
      .select("designer_id, contest_id, status, rating, is_shortlisted, contest:contests!contest_id(business_type, service)")
      .in("designer_id", ids)
      .not("status", "in", `(${GONE_STATUSES.join(",")})`)
      .limit(50000),
    db.from("profiles").select("id, wins_count").in("id", ids),
    db
      .from("contest_messages")
      .select("entry_id, designer_id, sender_id, created_at")
      .in("designer_id", ids)
      .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
      .order("created_at")
      .limit(20000),
  ]);
  const winsCount = new Map((profiles ?? []).map((p) => [p.id as string, (p.wins_count as number) ?? 0]));
  const contestsOf = new Map<string, Set<string>>();
  const typeCount = new Map<string, Map<string, number>>();
  const ratings = new Map<string, number[]>();
  for (const e of entries ?? []) {
    const id = e.designer_id as string;
    const s = out.get(id)!;
    const c = (Array.isArray(e.contest) ? e.contest[0] : e.contest) as { business_type: string; service: string | null } | null;
    const type = c?.service && c.service !== "logo" ? c.service : (c?.business_type ?? "other");
    s.entries++;
    if (e.is_shortlisted) s.shortlists++;
    if (typeof e.rating === "number" && e.rating > 0) (ratings.get(id) ?? ratings.set(id, []).get(id)!).push(e.rating as number);
    const set = contestsOf.get(id) ?? contestsOf.set(id, new Set()).get(id)!;
    if (!set.has(e.contest_id as string)) {
      set.add(e.contest_id as string);
      const tc = typeCount.get(id) ?? typeCount.set(id, new Map()).get(id)!;
      tc.set(type, (tc.get(type) ?? 0) + 1);
    }
    if (e.status === "winner") s.winsByType.set(type, (s.winsByType.get(type) ?? 0) + 1);
  }
  // Reply time: from a client's message to the designer's next message in the same chat (median, in minutes).
  const replies = new Map<string, number[]>();
  const waiting = new Map<string, number>();
  for (const m of msgs ?? []) {
    const key = m.entry_id as string;
    const t = new Date(m.created_at as string).getTime();
    if (m.sender_id !== m.designer_id) {
      if (!waiting.has(key)) waiting.set(key, t);
    } else if (waiting.has(key)) {
      (replies.get(m.designer_id as string) ?? replies.set(m.designer_id as string, []).get(m.designer_id as string)!).push((t - waiting.get(key)!) / 60_000);
      waiting.delete(key);
    }
  }
  for (const [id, s] of out) {
    const winRows = [...s.winsByType.values()].reduce((a, b) => a + b, 0);
    s.contests = contestsOf.get(id)?.size ?? 0;
    s.wins = Math.max(winsCount.get(id) ?? 0, winRows);
    s.winRate = Math.min(100, winRate(Math.min(s.wins, s.contests), s.contests));
    const r = ratings.get(id) ?? [];
    s.rated = r.length;
    s.rating = r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
    s.types = [...(typeCount.get(id)?.entries() ?? [])].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const rep = (replies.get(id) ?? []).sort((a, b) => a - b);
    s.replyMinutes = rep.length ? Math.round(rep[Math.floor(rep.length / 2)]) : null;
  }
  return out;
}
