import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { SHOWN_STATUSES } from "@/lib/entries/rules";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientDashboard, type DashboardContest } from "./dashboard";

/**
 * P-14 My contests (owner, 2026-10-11): the client's own contests in a short, visual form, opened from the menu in
 * place of Browse Contests. The full tools stay on the dashboard; this page shows where each contest is and what's next.
 */

/** Where a running contest is on its way: 1 getting designs, 2 picking a winner, 3 final files, 4 done. */
export type JourneyStep = 1 | 2 | 3 | 4;
export const journeyStep = (status: string): JourneyStep =>
  status === "open" ? 1 : status === "judging" ? 2 : status === "winner_selected" || status === "handover" ? 3 : 4;

export type MyContest = DashboardContest & {
  /** Newest designs first (up to 3 preview links), for the fanned cards. */
  latest: string[];
};

export type MyContests = {
  name: string;
  running: MyContest[];
  drafts: MyContest[];
  done: MyContest[];
  totals: { live: number; designs: number; won: number };
};

/** The three newest shown designs of each contest, as short-lived preview links (the cover image of each). */
async function latestDesigns(contestIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (contestIds.length === 0) return out;
  const { data } = await createAdminClient()
    .from("entries")
    .select("contest_id, created_at, images:entry_images!entry_id(position, preview_path)")
    .in("contest_id", contestIds)
    .in("status", SHOWN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(300);
  const paths = new Map<string, string[]>();
  for (const r of data ?? []) {
    const list = paths.get(r.contest_id as string) ?? [];
    if (list.length >= 3) continue;
    const cover = ((r.images ?? []) as { position: number; preview_path: string }[]).sort((a, b) => a.position - b.position)[0];
    if (cover) list.push(cover.preview_path);
    paths.set(r.contest_id as string, list);
  }
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, [...paths.values()].flat(), 3600)
    .catch(() => new Map<string, string>());
  for (const [id, list] of paths) out.set(id, list.map((p) => urls.get(p)).filter((u): u is string => Boolean(u)));
  return out;
}

export async function getMyContests(userId: string): Promise<MyContests> {
  const dash = await getClientDashboard(userId);
  const running = dash.contests.filter((c) => c.tab === "active");
  const latest = isSupabaseConfigured() ? await latestDesigns(running.map((c) => c.id)) : new Map<string, string[]>();
  const withLatest = (c: DashboardContest): MyContest => ({ ...c, latest: latest.get(c.id) ?? [] });
  const done = dash.contests.filter((c) => c.tab === "completed" && c.status !== "cancelled").map(withLatest);
  return {
    name: dash.profile.name,
    running: running.map(withLatest),
    drafts: dash.contests.filter((c) => c.tab === "drafts").map(withLatest),
    done,
    totals: {
      live: running.length,
      designs: dash.contests.reduce((n, c) => n + c.entries, 0),
      won: done.filter((c) => c.status === "completed").length,
    },
  };
}
