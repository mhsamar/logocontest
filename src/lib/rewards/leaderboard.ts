import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthRace } from "./race";
import { monthKey, recentMonths } from "./rules";

/**
 * The public leaderboard (owner, 2026-10-11; Design/rewards/leaderboard.html, BLUEPRINT §11). Only names, photos and
 * public numbers leave this file: never a designer's earnings, a client's spending, phone numbers or addresses.
 * Cached for a few minutes; it doesn't need to be real time.
 */

export type PublicPerson = { name: string; avatarUrl: string | null };
export type PublicRace = {
  clients: (PublicPerson & { contests: number; prizeTotal: number })[];
  /** earned: what their wins this month paid them, after the site fee (owner, 2026-10-13: shown like the clients' prize money). */
  designers: (PublicPerson & { wins: number; joined: number; earned: number })[];
  counts: { contestsPosted: number; clientsInRace: number; contestsWon: number; designersWithWin: number };
};

/** The name shown in public: a client's display name (or business name), a designer's name (or username). */
const shownName = (p: { name: string; username: string | null; businessName: string | null }) => p.name.trim() || p.businessName?.trim() || (p.username ? `@${p.username}` : "—");

export const publicRace = unstable_cache(
  async (month: string): Promise<PublicRace> => {
    const r = await monthRace(month);
    return {
      clients: r.clients.slice(0, 50).map((c) => ({ name: shownName(c.profile), avatarUrl: c.profile.avatarUrl, contests: c.contests, prizeTotal: c.prizeTotal })),
      designers: r.designers.slice(0, 50).map((d) => ({ name: shownName(d.profile), avatarUrl: d.profile.avatarUrl, wins: d.wins, joined: d.joined, earned: d.earned })),
      counts: r.counts,
    };
  },
  // v3 (owner, 2026-10-22): contests and accounts in the Trash no longer count; the new key drops cached old results.
  ["leaderboard-race-v3"],
  { revalidate: 300, tags: ["leaderboard"] },
);

/**
 * Who has how many this month, by user id, for the "this month" panel on the client and designer homes (owner,
 * 2026-10-11; Design/rewards/buyer-home-smartphone.html, designer-home-gift-box.html). Server only: a page shows a
 * person their own number and the leader's, nothing else. Cached like the leaderboard.
 */
export type RaceTally = { clients: Record<string, number>; topClient: { id: string; contests: number } | null; designers: Record<string, number>; topDesigner: { id: string; wins: number } | null };

export const raceTally = unstable_cache(
  async (month: string): Promise<RaceTally> => {
    const r = await monthRace(month);
    return {
      clients: Object.fromEntries(r.clients.map((c) => [c.id, c.contests])),
      topClient: r.clients[0] ? { id: r.clients[0].id, contests: r.clients[0].contests } : null,
      designers: Object.fromEntries(r.designers.map((d) => [d.id, d.wins])),
      topDesigner: r.designers[0] ? { id: r.designers[0].id, wins: r.designers[0].wins } : null,
    };
  },
  ["race-tally-v2"],
  { revalidate: 300, tags: ["leaderboard"] },
);

export type PastWinners = {
  month: string;
  smartphone: (PublicPerson & { contests: number; prizeTotal: number }) | null;
  giftBox: (PublicPerson & { wins: number }) | null;
};

/** Winners of past months (real rewards that were sent; never test ones), newest first. */
export const pastMonthWinners = unstable_cache(
  async (limit: number): Promise<PastWinners[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await createAdminClient()
      .from("monthly_rewards")
      .select("month, kind, stats, winner:profiles!winner_id(name, username, business_name, avatar_path, status)")
      .eq("is_test", false)
      .not("sent_at", "is", null)
      .order("month", { ascending: false })
      .limit(limit * 2);
    if (error) return [];
    const by = new Map<string, PastWinners>();
    for (const r of data ?? []) {
      const w = (Array.isArray(r.winner) ? r.winner[0] : r.winner) as { name: string; username: string | null; business_name: string | null; avatar_path: string | null; status: string } | null;
      // A winner later moved to the Trash isn't named any more.
      if (!w || w.status === "deleted") continue;
      const person = { name: shownName({ name: w.name ?? "", username: w.username, businessName: w.business_name }), avatarUrl: avatarUrl(w.avatar_path) };
      const s = (r.stats ?? {}) as Record<string, number>;
      const row = by.get(r.month as string) ?? { month: r.month as string, smartphone: null, giftBox: null };
      if (r.kind === "smartphone") row.smartphone = { ...person, contests: s.contests ?? 0, prizeTotal: s.prize_total ?? 0 };
      else row.giftBox = { ...person, wins: s.wins ?? 0 };
      by.set(r.month as string, row);
    }
    return [...by.values()].slice(0, limit);
  },
  ["leaderboard-past-v2"],
  { revalidate: 300, tags: ["leaderboard"] },
);

/** The months the tabs show: this month and the ones before it, back to the first contest (at most `n`), newest first. */
export const raceMonths = unstable_cache(
  async (current: string, n: number): Promise<string[]> => {
    const out = recentMonths(current, n);
    if (!isSupabaseConfigured()) return [current];
    const { data } = await createAdminClient().from("contests").select("starts_at").not("starts_at", "is", null).neq("status", "deleted").order("starts_at", { ascending: true }).limit(1).maybeSingle();
    if (!data?.starts_at) return [current];
    const first = monthKey(new Date(data.starts_at as string));
    return out.filter((m) => m >= first);
  },
  ["leaderboard-months-v2"],
  { revalidate: 3600, tags: ["leaderboard"] },
);
