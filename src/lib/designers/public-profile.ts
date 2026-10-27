import "server-only";
import { cache } from "react";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isPublicDesign, SHOWN_STATUSES, type EntryStatus } from "@/lib/entries/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import type { StudioDesign, StudioFile } from "@/lib/studio/queries";
import { STUDIO_MAX_FILES } from "@/lib/studio/options";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSkillLevel, type SkillLevel } from "./portfolio-options";

/**
 * Designer profile redesign (owner, 2026-10-12; Design/designer-profile). Everything here is real data and never
 * money. Designs follow the same public rule as before: never a private or NDA contest, and in a blind contest only
 * its public winner after it ends.
 */

/** Where a design stands: won (#1 of N), shortlisted, contest still open, or contest ended. */
export type Place = "won" | "shortlisted" | "open" | "ended";
export type ProfileDesign = StudioDesign & { rating: number | null; place: Place; entries: number; fileCount: number };
export type ProfileEvent = { kind: "sent" | "won" | "rated"; brand: string; at: string; stars?: number };
export type ProfileExtras = { ready: boolean; languages: string[]; skillLevels: Record<string, SkillLevel>; toolYears: Record<string, number> };
export type ProfileData = {
  designs: ProfileDesign[];
  stats: { wins: number; designs: number; contests: number; winRate: number; rating: number | null; rated: number };
  latestWin: { id: string; brandName: string; entries: number; at: string; thumb: string | null } | null;
  works: { type: string; count: number }[];
  activity: ProfileEvent[];
  verified: boolean;
  activeToday: boolean;
  extras: ProfileExtras;
};

/** Designs per page on the profile ("See more designs" loads the next ones). */
export const PROFILE_PAGE_SIZE = 12;

type Row = {
  id: string;
  number: number;
  status: EntryStatus;
  rating: number | null;
  is_shortlisted: boolean;
  /** Pro "Hide my design" (owner, 2026-10-14): public only once the winner is picked. */
  is_hidden: boolean | null;
  created_at: string;
  contest: { id: string; slug: string; brand_name: string; business_type: string; status: string; is_private: boolean; is_nda: boolean; is_blind: boolean; winner_is_public: boolean } | null;
  images: { position: number }[];
};

/** The designer's public designs, newest first (read once per request). */
const publicRows = cache(async (designerId: string): Promise<(Row & { contest: NonNullable<Row["contest"]> })[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("entries")
    .select(
      "id, number, status, rating, is_shortlisted, is_hidden, created_at, contest:contests!contest_id(id, slug, brand_name, business_type, status, is_private, is_nda, is_blind, winner_is_public), images:entry_images!entry_id(position)",
    )
    .eq("designer_id", designerId)
    .not("status", "in", "(removed,withdrawn)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).flatMap((r) => {
    const c = Array.isArray(r.contest) ? (r.contest[0] ?? null) : r.contest;
    if (!c) return [];
    const ok = isPublicDesign({ status: r.status, isHidden: r.is_hidden }, { status: c.status, isPrivate: c.is_private || Boolean(c.is_nda), isBlind: c.is_blind, winnerIsPublic: c.winner_is_public });
    return ok ? [{ ...r, contest: c }] : [];
  });
});

/** Signed links to the files (up to 8, in order, with their names) of these designs. */
async function signFiles(ids: string[]): Promise<Record<string, StudioFile[]>> {
  if (ids.length === 0) return {};
  const { data } = await createAdminClient().from("entry_images").select("entry_id, position, preview_path, label").in("entry_id", ids).order("position", { ascending: true });
  const byEntry = new Map<string, { path: string; label: string | null }[]>();
  for (const img of data ?? []) {
    const list = byEntry.get(img.entry_id as string) ?? [];
    if (list.length < STUDIO_MAX_FILES) list.push({ path: img.preview_path as string, label: ((img.label as string | null) ?? "").trim() || null });
    byEntry.set(img.entry_id as string, list);
  }
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, [...byEntry.values()].flat().map((f) => f.path), 3600, { width: 640 })
    .catch(() => new Map<string, string>());
  const out: Record<string, StudioFile[]> = {};
  for (const id of ids) out[id] = (byEntry.get(id) ?? []).flatMap((f) => (urls.has(f.path) ? [{ url: urls.get(f.path)!, label: f.label }] : []));
  return out;
}

/** Files for more of this designer's designs ("See more", other tabs). Only public designs of this designer. */
export async function profileFiles(designerId: string, ids: string[]): Promise<Record<string, StudioFile[]>> {
  const allowed = new Set((await publicRows(designerId)).map((r) => r.id));
  return signFiles([...new Set(ids)].filter((id) => allowed.has(id)).slice(0, 48));
}

/** The optional extras from Edit profile (migration 0042). Before that SQL runs they are simply empty. */
async function extras(designerId: string, skills: string[], tools: string[]): Promise<ProfileExtras> {
  const empty: ProfileExtras = { ready: false, languages: [], skillLevels: {}, toolYears: {} };
  if (!isSupabaseConfigured()) return empty;
  const { data, error } = await createAdminClient().from("profiles").select("languages, skill_levels, tool_years").eq("id", designerId).maybeSingle();
  if (error || !data) return empty;
  const levels: Record<string, SkillLevel> = {};
  for (const [k, v] of Object.entries((data.skill_levels as Record<string, unknown> | null) ?? {})) if (skills.includes(k) && isSkillLevel(v)) levels[k] = v;
  const years: Record<string, number> = {};
  for (const [k, v] of Object.entries((data.tool_years as Record<string, unknown> | null) ?? {})) if (tools.includes(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 60) years[k] = v as number;
  const languages = ((data.languages as string[] | null) ?? []).filter((l) => typeof l === "string" && l.trim()).slice(0, 8);
  return { ready: true, languages, skillLevels: levels, toolYears: years };
}

export async function designerProfileData(designer: { id: string; username: string; avatarUrl: string | null; winsCount: number; skills: string[]; tools: string[] }): Promise<ProfileData> {
  const db = createAdminClient();
  const rows = await publicRows(designer.id);

  // "#1 of N": how many designs each of the designer's winning contests got.
  const winRows = rows.filter((r) => r.status === "winner");
  const entriesIn = new Map<string, number>();
  if (winRows.length > 0) {
    const { data } = await db
      .from("entries")
      .select("contest_id")
      .in(
        "contest_id",
        winRows.map((r) => r.contest.id),
      )
      .in("status", SHOWN_STATUSES)
      .limit(20000);
    for (const e of data ?? []) entriesIn.set(e.contest_id as string, (entriesIn.get(e.contest_id as string) ?? 0) + 1);
  }

  // Files for the first page of each tab, so switching tabs is instant.
  const rated = rows.filter((r) => r.rating);
  const first = [...rows.slice(0, PROFILE_PAGE_SIZE), ...winRows.slice(0, PROFILE_PAGE_SIZE), ...rated.slice(0, PROFILE_PAGE_SIZE)].map((r) => r.id);

  const [files, seen, agreement, wonAt, ratedNotes, extra] = await Promise.all([
    signFiles([...new Set(first)]),
    isSupabaseConfigured() ? db.from("profiles").select("last_seen_at").eq("id", designer.id).maybeSingle() : Promise.resolve({ data: null }),
    isSupabaseConfigured() ? db.from("designer_agreements").select("review_status").eq("designer_id", designer.id).maybeSingle() : Promise.resolve({ data: null }),
    winRows.length > 0 ? db.from("handovers").select("entry_id, created_at").in("entry_id", winRows.map((r) => r.id)).neq("status", "cancelled") : Promise.resolve({ data: [] }),
    isSupabaseConfigured()
      ? db.from("notifications").select("data, link, created_at").eq("user_id", designer.id).eq("type", "entry_rated").order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    extras(designer.id, designer.skills, designer.tools),
  ]);

  const place = (r: (typeof rows)[number]): Place => (r.status === "winner" ? "won" : r.is_shortlisted ? "shortlisted" : r.contest.status === "open" ? "open" : "ended");
  const designs: ProfileDesign[] = rows.map((r) => ({
    id: r.id,
    contestSlug: r.contest.slug,
    brandName: r.contest.brand_name,
    number: r.number,
    isWinner: r.status === "winner",
    designer: r.contest.is_blind ? null : { username: designer.username, avatarUrl: designer.avatarUrl },
    files: files[r.id] ?? [],
    createdAt: r.created_at,
    rating: r.rating ?? null,
    place: place(r),
    entries: entriesIn.get(r.contest.id) ?? 0,
    fileCount: r.images?.length ?? 0,
  }));

  const contests = new Set(rows.map((r) => r.contest.id)).size;
  const ratings = rows.map((r) => r.rating).filter((v): v is number => typeof v === "number" && v > 0);
  const wins = Math.max(designer.winsCount, winRows.length);
  const wonTime = new Map(((wonAt.data ?? []) as { entry_id: string; created_at: string }[]).map((h) => [h.entry_id, h.created_at]));

  const lw = winRows[0];
  const latestWin = lw
    ? { id: lw.id, brandName: lw.contest.brand_name, entries: entriesIn.get(lw.contest.id) ?? 0, at: wonTime.get(lw.id) ?? lw.created_at, thumb: files[lw.id]?.[0]?.url ?? null }
    : null;

  // Works most with: business types of the (public) contests joined.
  const byType = new Map<string, number>();
  for (const id of new Set(rows.map((r) => r.contest.id))) {
    const type = rows.find((r) => r.contest.id === id)!.contest.business_type;
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  const works = [...byType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 4);

  // Recent activity: designs sent, wins, and client ratings (only for public designs).
  const bySlugNo = new Map(rows.map((r) => [`${r.contest.slug}#${r.number}`, r]));
  const rateEvents: ProfileEvent[] = ((ratedNotes.data ?? []) as { data: { stars?: number }; link: string | null; created_at: string }[]).flatMap((n) => {
    const m = n.link?.match(/^\/contest\/([^?/]+)\?.*entry=(\d+)/);
    const r = m ? bySlugNo.get(`${m[1]}#${m[2]}`) : undefined;
    return r && n.data?.stars ? [{ kind: "rated" as const, brand: r.contest.brand_name, at: n.created_at, stars: n.data.stars }] : [];
  });
  const activity = [
    ...rows.slice(0, 6).map((r) => ({ kind: "sent" as const, brand: r.contest.brand_name, at: r.created_at })),
    ...winRows.map((r) => ({ kind: "won" as const, brand: r.contest.brand_name, at: wonTime.get(r.id) ?? r.created_at })),
    ...rateEvents,
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 4);

  const lastSeen = (seen.data as { last_seen_at: string | null } | null)?.last_seen_at;
  return {
    designs,
    stats: {
      wins,
      designs: rows.length,
      contests,
      winRate: contests > 0 ? Math.min(100, Math.round((Math.min(wins, contests) / contests) * 100)) : 0,
      rating: ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      rated: ratings.length,
    },
    latestWin,
    works,
    activity,
    verified: (agreement.data as { review_status?: string } | null)?.review_status === "approved",
    activeToday: Boolean(lastSeen && Date.now() - new Date(lastSeen).getTime() < 86_400_000),
    extras: extra,
  };
}
