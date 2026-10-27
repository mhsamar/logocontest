import "server-only";
import { cache } from "react";
import { PUBLIC_STATUSES } from "@/lib/contests/public-statuses";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isPublicDesign, SHOWN_STATUSES, type EntryStatus } from "@/lib/entries/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { startOfDhakaDay, STUDIO_MAX_FILES, STUDIO_PAGE_SIZE, type StudioQuery } from "./options";

/**
 * Design Studio (UI-JOURNEY P-13; redesign owner 2026-10-12, Design/design-studio). Only designs the site already
 * shows publicly: never a private or NDA contest, and in a blind contest only its public winner after it ends
 * (isPublicDesign, unchanged). The designer appears by @username and photo only: no real name, no profile link.
 */

/** One file of a design: a signed link to its preview (the site keeps no smaller size) and its name, if any. */
export type StudioFile = { url: string; label: string | null };

export type StudioDesign = {
  id: string;
  contestSlug: string;
  brandName: string;
  number: number;
  isWinner: boolean;
  /** Null in blind contests (the designer stays hidden). */
  designer: { username: string | null; avatarUrl: string | null } | null;
  /** Up to 8 files, in order. */
  files: StudioFile[];
  createdAt: string;
};

export type StudioPage = { designs: StudioDesign[]; total: number; nextOffset: number | null };
export type StudioStats = { designs: number; today: number; winners: number };
export type StudioEvent = { kind: "sent" | "won"; username: string | null; avatarUrl: string | null; brand: string; at: string };
export type StudioHero = { thumbs: string[]; events: StudioEvent[] };

type Profile = { username: string | null; avatar_path: string | null };
type Light = {
  id: string;
  number: number;
  status: EntryStatus;
  /** Pro "Hide my design" (owner, 2026-10-14): public only once the winner is picked. */
  is_hidden: boolean | null;
  created_at: string;
  designer: Profile | Profile[] | null;
  contest: { slug: string; brand_name: string; business_type: string; status: string; is_private: boolean; is_blind: boolean; winner_is_public: boolean };
  images: { position: number }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const LIGHT =
  "id, number, status, is_hidden, created_at, designer:profiles!designer_id(username, avatar_path), contest:contests!contest_id!inner(slug, brand_name, business_type, status, is_private, is_nda, is_blind, winner_is_public, owner:profiles!client_id!inner(is_test)), images:entry_images!entry_id(position)";
const isPublic = (r: Light) =>
  isPublicDesign({ status: r.status, isHidden: r.is_hidden }, { status: r.contest.status, isPrivate: r.contest.is_private, isBlind: r.contest.is_blind, winnerIsPublic: r.contest.winner_is_public });

/** Every public design, newest first (light rows: no file links). Shared by the hero and the grid in one request. */
const publicDesigns = cache(async (): Promise<Light[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("entries")
    .select(LIGHT)
    .in("status", SHOWN_STATUSES)
    .eq("contest.is_private", false)
    // NDA contests include everything Private does (§7.4), so their designs stay out too.
    .eq("contest.is_nda", false)
    .in("contest.status", [...PUBLIC_STATUSES])
    // Never a test client's contest (owner, 2026-10-22).
    .eq("contest.owner.is_test", false)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Light[]).filter(isPublic);
});

/** Likes per design (only read when sorting by "Most liked"). */
async function likeCounts(): Promise<Map<string, number>> {
  const { data } = await createAdminClient().from("entry_votes").select("entry_id").eq("vote", 1).limit(50000);
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(r.entry_id as string, (m.get(r.entry_id as string) ?? 0) + 1);
  return m;
}

/** Signed links to the files of these designs (up to 8 each, in order), with their names. */
async function withFiles(rows: Light[]): Promise<StudioDesign[]> {
  if (rows.length === 0) return [];
  const { data } = await createAdminClient()
    .from("entry_images")
    .select("entry_id, position, preview_path, label")
    .in(
      "entry_id",
      rows.map((r) => r.id),
    )
    .order("position", { ascending: true });
  const byEntry = new Map<string, { preview_path: string; label: string | null }[]>();
  for (const img of data ?? []) {
    const list = byEntry.get(img.entry_id as string) ?? [];
    if (list.length < STUDIO_MAX_FILES) list.push({ preview_path: img.preview_path as string, label: ((img.label as string | null) ?? "").trim() || null });
    byEntry.set(img.entry_id as string, list);
  }
  const paths = [...byEntry.values()].flat().map((f) => f.preview_path);
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, paths, 3600, { width: 640 })
    .catch(() => new Map<string, string>());
  return rows.map((r) => {
    const designer = r.contest.is_blind ? null : one(r.designer);
    return {
      id: r.id,
      contestSlug: r.contest.slug,
      brandName: r.contest.brand_name,
      number: r.number,
      isWinner: r.status === "winner",
      designer: designer ? { username: designer.username, avatarUrl: avatarUrl(designer.avatar_path) } : null,
      files: (byEntry.get(r.id) ?? []).flatMap((f) => {
        const url = urls.get(f.preview_path);
        return url ? [{ url, label: f.label }] : [];
      }),
      createdAt: r.created_at,
    };
  });
}

/** One page of the grid for a query (tab, search, business type, sort), 24 at a time. */
export async function listStudio(q: StudioQuery, offset = 0): Promise<StudioPage> {
  const all = await publicDesigns();
  const since = startOfDhakaDay();
  const needle = q.q.toLowerCase().replace(/^@/, "");
  let rows = all.filter((r) => {
    if (q.tab === "winners" && r.status !== "winner") return false;
    if (q.tab === "new" && r.created_at < since) return false;
    if (q.type && r.contest.business_type !== q.type) return false;
    if (needle) {
      const designer = r.contest.is_blind ? null : one(r.designer);
      const hay = `${r.contest.brand_name} ${designer?.username ?? ""} #${r.number}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  if (q.sort === "oldest") rows = [...rows].reverse();
  else if (q.sort === "files") rows = [...rows].sort((a, b) => (b.images?.length ?? 0) - (a.images?.length ?? 0) || (a.created_at < b.created_at ? 1 : -1));
  else if (q.sort === "liked") {
    const likes = await likeCounts();
    rows = [...rows].sort((a, b) => (likes.get(b.id) ?? 0) - (likes.get(a.id) ?? 0) || (a.created_at < b.created_at ? 1 : -1));
  }
  const start = Math.max(0, Math.floor(offset));
  const slice = rows.slice(start, start + STUDIO_PAGE_SIZE);
  return { designs: await withFiles(slice), total: rows.length, nextOffset: start + STUDIO_PAGE_SIZE < rows.length ? start + STUDIO_PAGE_SIZE : null };
}

/** One public design by id (a direct link with ?design=), or null when it isn't public. */
export async function getStudioDesign(id: string): Promise<StudioDesign | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = (await publicDesigns()).find((r) => r.id === id);
  return row ? ((await withFiles([row]))[0] ?? null) : null;
}

/** Real counts for the hero and the tabs: public designs, sent today (Dhaka day) and winners. */
export async function studioStats(): Promise<StudioStats> {
  const all = await publicDesigns();
  const since = startOfDhakaDay();
  return { designs: all.length, today: all.filter((r) => r.created_at >= since).length, winners: all.filter((r) => r.status === "winner").length };
}

/**
 * The hero's moving columns (the first file of the latest ~15 designs) and the floating card's last 3 real events:
 * a design sent, or a winner picked (when the winner was picked, from the delivery record).
 */
export async function studioHero(): Promise<StudioHero> {
  const all = await publicDesigns();
  const latest = all.slice(0, 15);
  const covers = new Map<string, string>();
  if (latest.length > 0) {
    const { data } = await createAdminClient()
      .from("entry_images")
      .select("entry_id, position, preview_path")
      .in(
        "entry_id",
        latest.map((r) => r.id),
      )
      .eq("position", 0);
    const urls = await getFileStorage()
      .createReadUrls(ENTRY_FILES_BUCKET, (data ?? []).map((d) => d.preview_path as string), 3600, { width: 640 })
      .catch(() => new Map<string, string>());
    for (const d of data ?? []) {
      const url = urls.get(d.preview_path as string);
      if (url) covers.set(d.entry_id as string, url);
    }
  }
  const thumbs = latest.flatMap((r) => (covers.has(r.id) ? [covers.get(r.id)!] : []));

  const person = (r: Light) => {
    const d = r.contest.is_blind ? null : one(r.designer);
    return { username: d?.username ?? null, avatarUrl: avatarUrl(d?.avatar_path) };
  };
  const sent: StudioEvent[] = all.slice(0, 3).map((r) => ({ kind: "sent", ...person(r), brand: r.contest.brand_name, at: r.created_at }));
  const winners = all.filter((r) => r.status === "winner");
  let won: StudioEvent[] = [];
  if (winners.length > 0) {
    const { data } = await createAdminClient()
      .from("handovers")
      .select("entry_id, created_at")
      .in(
        "entry_id",
        winners.slice(0, 50).map((r) => r.id),
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(3);
    won = (data ?? []).flatMap((h) => {
      const r = winners.find((w) => w.id === h.entry_id);
      return r ? [{ kind: "won" as const, ...person(r), brand: r.contest.brand_name, at: h.created_at as string }] : [];
    });
  }
  const events = [...sent, ...won].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 3);
  return { thumbs, events };
}
