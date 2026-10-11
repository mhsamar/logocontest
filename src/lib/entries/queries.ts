import "server-only";
import { likesFor } from "@/lib/rewards/likes";
import type { CurrentUser } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSeeEntry, entryScope, GONE_STATUSES, SHOWN_STATUSES, showDesignerName, sortEntries, type ContestForEntries, type EntrySort, type EntryStatus } from "./rules";

/** Designs (entries) on the contest page: the grid, the viewer and their comments (UI-JOURNEY P-03, P-04). */

export const ENTRY_FILES_BUCKET = "entry-files";
const LINK_SECONDS = 3600;

export type EntryCard = {
  id: string;
  number: number;
  status: EntryStatus;
  designerId: string;
  /** Null when the name is hidden (blind contest). */
  designer: { name: string; username: string | null } | null;
  rating: number | null;
  isShortlisted: boolean;
  imageCount: number;
  /** Signed links to the previews, cover first. The grid uses up to four. */
  previews: string[];
  commentCount: number;
  mine: boolean;
  /** Likes on a winning design (owner, 2026-10-09); 0 for other designs. */
  likes: number;
  liked: boolean;
  /** Like and dislike votes on the design (owner, 2026-10-11), and the viewer's own vote. */
  upVotes: number;
  downVotes: number;
  myVote: -1 | 0 | 1;
};

export type EntryComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { name: string; username: string | null; role: "client" | "designer" | "admin"; isContestClient: boolean };
  mine: boolean;
};

export type EntryDetail = EntryCard & { story: string | null; comments: EntryComment[] };

type Row = {
  id: string;
  number: number;
  status: EntryStatus;
  designer_id: string;
  rating: number | null;
  is_shortlisted: boolean;
  logo_story: string | null;
  designer: { name: string; username: string | null } | { name: string; username: string | null }[] | null;
  images: { position: number; preview_path: string }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function commentCounts(entryIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (entryIds.length === 0) return out;
  const { data } = await createAdminClient().from("entry_comments").select("entry_id").in("entry_id", entryIds).eq("is_hidden", false).is("deleted_at", null);
  for (const r of data ?? []) out.set(r.entry_id as string, (out.get(r.entry_id as string) ?? 0) + 1);
  return out;
}

/** Like and dislike counts per design, and the viewer's own vote (owner, 2026-10-11). */
async function voteCounts(entryIds: string[], viewerId: string | null): Promise<Map<string, { up: number; down: number; mine: -1 | 0 | 1 }>> {
  const out = new Map<string, { up: number; down: number; mine: -1 | 0 | 1 }>();
  if (entryIds.length === 0) return out;
  const { data } = await createAdminClient().from("entry_votes").select("entry_id, user_id, vote").in("entry_id", entryIds);
  for (const r of data ?? []) {
    const v = out.get(r.entry_id as string) ?? { up: 0, down: 0, mine: 0 };
    if (r.vote === 1) v.up += 1;
    else v.down += 1;
    if (viewerId && r.user_id === viewerId) v.mine = r.vote === 1 ? 1 : -1;
    out.set(r.entry_id as string, v);
  }
  return out;
}

async function toCards(rows: Row[], contest: ContestForEntries, viewer: CurrentUser | null, previewLimit: number): Promise<EntryCard[]> {
  const sorted = rows.map((r) => ({ ...r, images: [...(r.images ?? [])].sort((a, b) => a.position - b.position) }));
  const paths = sorted.flatMap((r) => r.images.slice(0, previewLimit).map((i) => i.preview_path));
  const winners = sorted.filter((r) => r.status === "winner").map((r) => r.id);
  const [urls, counts, likes, votes] = await Promise.all([
    getFileStorage().createReadUrls(ENTRY_FILES_BUCKET, paths, LINK_SECONDS).catch(() => new Map<string, string>()),
    commentCounts(sorted.map((r) => r.id)),
    likesFor(winners, viewer?.id ?? null),
    voteCounts(sorted.map((r) => r.id), viewer?.id ?? null),
  ]);
  return sorted.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    designerId: r.designer_id,
    designer: showDesignerName(contest, viewer, r.designer_id) ? one(r.designer) : null,
    rating: r.rating,
    isShortlisted: r.is_shortlisted,
    imageCount: r.images.length,
    previews: r.images
      .slice(0, previewLimit)
      .map((i) => urls.get(i.preview_path))
      .filter((u): u is string => Boolean(u)),
    commentCount: counts.get(r.id) ?? 0,
    mine: r.designer_id === viewer?.id,
    likes: likes.counts.get(r.id) ?? 0,
    liked: likes.mine.has(r.id),
    upVotes: votes.get(r.id)?.up ?? 0,
    downVotes: votes.get(r.id)?.down ?? 0,
    myVote: votes.get(r.id)?.mine ?? 0,
  }));
}

const SELECT = "id, number, status, designer_id, rating, is_shortlisted, logo_story, designer:profiles!designer_id(name, username), images:entry_images!entry_id(position, preview_path)";

/** The designs this viewer may see, best rated first with the winner on top, or in the chosen order (owner, 2026-10-11). */
export async function listEntries(contestId: string, contest: ContestForEntries, viewer: CurrentUser | null, sort: EntrySort = "top"): Promise<EntryCard[]> {
  if (!isSupabaseConfigured()) return [];
  const scope = entryScope(contest, viewer);
  if (scope.kind === "none") return [];
  const { data, error } = await createAdminClient().from("entries").select(SELECT).eq("contest_id", contestId).not("status", "in", `(${GONE_STATUSES.join(",")})`).order("number", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as Row[]).filter((r) => canSeeEntry(scope, { status: r.status, designerId: r.designer_id }));
  return sortEntries(await toCards(rows, contest, viewer, 4), sort);
}

/** One design with every mockup, its story and its comments; null when this viewer may not see it. */
export async function getEntryDetail(contestId: string, number: number, contest: ContestForEntries, viewer: CurrentUser | null): Promise<EntryDetail | null> {
  if (!isSupabaseConfigured() || !Number.isInteger(number) || number < 1) return null;
  const { data, error } = await createAdminClient().from("entries").select(SELECT).eq("contest_id", contestId).eq("number", number).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Row;
  if (!canSeeEntry(entryScope(contest, viewer), { status: row.status, designerId: row.designer_id })) return null;
  const [card] = await toCards([row], contest, viewer, 8);
  return { ...card, story: row.logo_story, comments: await listEntryComments(row.id, contest.ownerId, viewer) };
}

export async function listEntryComments(entryId: string, contestOwnerId: string, viewer: CurrentUser | null): Promise<EntryComment[]> {
  const { data, error } = await createAdminClient()
    .from("entry_comments")
    .select("id, body, created_at, user_id, author:profiles!user_id(name, username, role)")
    .eq("entry_id", entryId)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const a = one(r.author as EntryComment["author"] | EntryComment["author"][] | null);
    return {
      id: r.id as string,
      body: r.body as string,
      createdAt: new Date(r.created_at as string),
      author: { name: a?.name ?? "—", username: a?.username ?? null, role: a?.role ?? "client", isContestClient: r.user_id === contestOwnerId },
      mine: r.user_id === viewer?.id,
    };
  });
}

/** Whether this designer has submitted at least one design to the contest (may comment on designs). */
export async function hasEntryIn(contestId: string, userId: string | undefined): Promise<boolean> {
  if (!userId || !isSupabaseConfigured()) return false;
  const { count } = await createAdminClient().from("entries").select("id", { count: "exact", head: true }).eq("contest_id", contestId).eq("designer_id", userId).not("status", "in", `(${GONE_STATUSES.join(",")})`);
  return (count ?? 0) > 0;
}

/** Public design counts per contest (active and winning designs). */
export async function countShownEntries(contestIds: string[]): Promise<Map<string, number>> {
  const out = new Map(contestIds.map((id) => [id, 0]));
  if (contestIds.length === 0 || !isSupabaseConfigured()) return out;
  const { data } = await createAdminClient().from("entries").select("contest_id").in("contest_id", contestIds).in("status", SHOWN_STATUSES);
  for (const r of data ?? []) out.set(r.contest_id as string, (out.get(r.contest_id as string) ?? 0) + 1);
  return out;
}

/** Distinct designers with a shown design, for the contest stats. */
export async function countDesigners(contestId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { data } = await createAdminClient().from("entries").select("designer_id").eq("contest_id", contestId).in("status", SHOWN_STATUSES);
  return new Set((data ?? []).map((r) => r.designer_id as string)).size;
}

export type ContestCover = { url: string; isWinner: boolean };

/**
 * The design shown on a contest's card (owner, 2026-10-08): the winner once picked,
 * otherwise the highest-rated design, otherwise the newest. Blind and private contests
 * keep the brand letter in public lists; pass `owner` for the client's own dashboard.
 */
export async function leadingDesigns(contests: { id: string; isBlind: boolean; isPrivate: boolean }[], owner = false): Promise<Map<string, ContestCover>> {
  const out = new Map<string, ContestCover>();
  const ids = contests.filter((c) => owner || (!c.isBlind && !c.isPrivate)).map((c) => c.id);
  if (ids.length === 0 || !isSupabaseConfigured()) return out;
  const { data } = await createAdminClient()
    .from("entries")
    .select("contest_id, status, rating, number, images:entry_images!entry_id(position, preview_path)")
    .in("contest_id", ids)
    .in("status", SHOWN_STATUSES);
  const best = new Map<string, { status: string; rating: number | null; number: number; path: string }>();
  const rank = (e: { status: string; rating: number | null; number: number }) => [e.status === "winner" ? 1 : 0, e.rating ?? 0, e.number];
  const better = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  for (const r of data ?? []) {
    const cover = ((r.images ?? []) as { position: number; preview_path: string }[]).sort((a, b) => a.position - b.position)[0];
    if (!cover) continue;
    const e = { status: r.status as string, rating: r.rating as number | null, number: r.number as number, path: cover.preview_path };
    const cur = best.get(r.contest_id as string);
    if (!cur || better(rank(e), rank(cur)) > 0) best.set(r.contest_id as string, e);
  }
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, [...best.values()].map((b) => b.path), LINK_SECONDS)
    .catch(() => new Map<string, string>());
  for (const [contestId, b] of best) {
    const url = urls.get(b.path);
    if (url) out.set(contestId, { url, isWinner: b.status === "winner" });
  }
  return out;
}

export type ContestDesigner = { name: string; username: string | null; avatarUrl: string | null };

/** Designers with a shown design in the contest, newest first (P-03 "Designers taking part"). */
export async function contestDesigners(contestId: string, limit: number): Promise<{ total: number; list: ContestDesigner[] }> {
  if (!isSupabaseConfigured()) return { total: 0, list: [] };
  const { data } = await createAdminClient()
    .from("entries")
    .select("designer_id, designer:profiles!designer_id(name, username, avatar_path)")
    .eq("contest_id", contestId)
    .in("status", SHOWN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1000);
  const seen = new Map<string, ContestDesigner>();
  for (const r of data ?? []) {
    if (seen.has(r.designer_id as string)) continue;
    const p = one(r.designer as { name: string; username: string | null; avatar_path: string | null } | { name: string; username: string | null; avatar_path: string | null }[] | null);
    seen.set(r.designer_id as string, { name: p?.name ?? "—", username: p?.username ?? null, avatarUrl: avatarUrl(p?.avatar_path) });
  }
  return { total: seen.size, list: [...seen.values()].slice(0, limit) };
}

/** Card faces (owner, 2026-10-08): up to `limit` designers per contest, newest first, and how many in all. */
export async function designerFaces(
  contests: { id: string; isBlind: boolean; isPrivate: boolean }[],
  limit: number,
): Promise<Map<string, { total: number; list: ContestDesigner[] }>> {
  const out = new Map<string, { total: number; list: ContestDesigner[] }>();
  if (contests.length === 0 || !isSupabaseConfigured()) return out;
  const hidden = new Set(contests.filter((c) => c.isBlind || c.isPrivate).map((c) => c.id));
  const { data } = await createAdminClient()
    .from("entries")
    .select("contest_id, designer_id, designer:profiles!designer_id(name, username, avatar_path)")
    .in("contest_id", contests.map((c) => c.id))
    .in("status", SHOWN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(5000);
  const seen = new Map<string, Set<string>>();
  for (const r of data ?? []) {
    const cid = r.contest_id as string;
    const ids = seen.get(cid) ?? new Set<string>();
    if (ids.has(r.designer_id as string)) continue;
    ids.add(r.designer_id as string);
    seen.set(cid, ids);
    const entry = out.get(cid) ?? { total: 0, list: [] };
    entry.total += 1;
    // Blind and private contests show only the count, never who took part.
    if (!hidden.has(cid) && entry.list.length < limit) {
      const p = one(r.designer as { name: string; username: string | null; avatar_path: string | null } | { name: string; username: string | null; avatar_path: string | null }[] | null);
      entry.list.push({ name: p?.name ?? "—", username: p?.username ?? null, avatarUrl: avatarUrl(p?.avatar_path) });
    }
    out.set(cid, entry);
  }
  return out;
}
