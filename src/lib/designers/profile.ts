import "server-only";
import { cache } from "react";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isPublicDesign, type EntryStatus } from "@/lib/entries/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { getSetting } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/** Designer public profile (P-06) and dashboard (D-02) data. */

export type DesignerStats = {
  contestsEntered: number;
  designs: number;
  wins: number;
  /** Public total earned: prize credits, shares and bonuses after fees (BLUEPRINT §8.3). */
  totalEarned: number;
};

export type DesignerProfile = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  memberSince: Date;
  isTopDesigner: boolean;
  stats: DesignerStats;
  /** Portfolio (owner, 2026-10-08): list keys or one free "other" each. */
  skills: string[];
  tools: string[];
  experienceYears: number | null;
};

// ---------------------------------------------------------------------------
// The designer's designs (entries), read once per request
// ---------------------------------------------------------------------------

type EntryRow = {
  number: number;
  status: EntryStatus;
  rating: number | null;
  createdAt: string;
  contest: { id: string; slug: string; brandName: string; status: string; isPrivate: boolean; isBlind: boolean; winnerIsPublic: boolean };
  /** Cover mockup (position 0) and how many mockups. */
  coverPath: string | null;
  imageCount: number;
};

const designerEntries = cache(async (designerId: string): Promise<EntryRow[]> => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("entries")
    .select(
      "number, status, rating, created_at, contest:contests!contest_id(id, slug, brand_name, status, is_private, is_blind, winner_is_public), images:entry_images!entry_id(position, preview_path)",
    )
    .eq("designer_id", designerId)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((r) => {
    const c = (Array.isArray(r.contest) ? r.contest[0] : r.contest) as
      | { id: string; slug: string; brand_name: string; status: string; is_private: boolean; is_blind: boolean; winner_is_public: boolean }
      | null;
    if (!c) return [];
    const images = ((r.images ?? []) as { position: number; preview_path: string }[]).sort((a, b) => a.position - b.position);
    return [
      {
        number: r.number as number,
        status: r.status as EntryStatus,
        rating: r.rating as number | null,
        createdAt: r.created_at as string,
        contest: { id: c.id, slug: c.slug, brandName: c.brand_name, status: c.status, isPrivate: c.is_private, isBlind: c.is_blind, winnerIsPublic: c.winner_is_public },
        coverPath: images[0]?.preview_path ?? null,
        imageCount: images.length,
      },
    ];
  });
});

/**
 * Designs anyone may see on the public profile (BLUEPRINT §8.3): never from private
 * contests; from blind contests only the winner once the client made it public.
 */
const isPublic = (e: EntryRow) => isPublicDesign(e, e.contest);

async function coverUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const list = paths.filter((p): p is string => Boolean(p));
  return getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, [...new Set(list)], 3600)
    .catch(() => new Map<string, string>());
}

/** Total earned (BLUEPRINT §9.4): prize credits, shared prizes and bonuses in the wallet, after fees. */
async function totalEarned(designerId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { data } = await createAdminClient().from("wallet_transactions").select("amount").eq("designer_id", designerId).in("type", ["prize_credit", "split_share", "bonus"]);
  return (data ?? []).reduce((sum, r) => sum + (r.amount as number), 0);
}

async function statsFor(designerId: string, winsCount: number, view: "own" | "public"): Promise<DesignerStats> {
  const [rows, earned] = await Promise.all([designerEntries(designerId), totalEarned(designerId)]);
  const shown = view === "own" ? rows : rows.filter(isPublic);
  return { contestsEntered: new Set(shown.map((e) => e.contest.id)).size, designs: shown.length, wins: winsCount, totalEarned: earned };
}

type Row = {
  id: string;
  name: string;
  username: string | null;
  bio: string | null;
  avatar_path: string | null;
  created_at: string;
  wins_count: number;
  counted_wins_count: number;
  skills: string[] | null;
  tools: string[] | null;
  experience_years: number | null;
};

async function toProfile(r: Row, view: "own" | "public"): Promise<DesignerProfile> {
  const topMin = await getSetting("limits.top_designer_min_wins");
  return {
    id: r.id,
    name: r.name,
    username: r.username ?? "",
    bio: r.bio,
    avatarUrl: avatarUrl(r.avatar_path),
    memberSince: new Date(r.created_at),
    isTopDesigner: r.counted_wins_count >= topMin,
    stats: await statsFor(r.id, r.wins_count, view),
    skills: r.skills ?? [],
    tools: r.tools ?? [],
    experienceYears: r.experience_years,
  };
}

const COLUMNS = "id, name, username, bio, avatar_path, created_at, wins_count, counted_wins_count, skills, tools, experience_years";

/** Active designer by username (case-insensitive), or null. */
export async function designerByUsername(username: string): Promise<DesignerProfile | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9_]{3,20}$/i.test(username)) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select(COLUMNS)
    .eq("username", username.toLowerCase())
    .eq("role", "designer")
    .eq("status", "active")
    .maybeSingle<Row>();
  return data ? toProfile(data, "public") : null;
}

/** The designer's own view (dashboard): counts every design they submitted. */
export async function designerById(id: string): Promise<DesignerProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("profiles").select(COLUMNS).eq("id", id).maybeSingle<Row>();
  return data ? toProfile(data, "own") : null;
}

export type DesignerContest = {
  slug: string;
  brandName: string;
  status: string;
  myEntries: number;
  won: boolean;
  winningLogoUrl: string | null;
  /** Cover of the designer's newest design in this contest. */
  latestCoverUrl: string | null;
};

/** D-02 "My contests": every contest the designer submitted to, newest design first. */
export async function designerContests(userId: string): Promise<DesignerContest[]> {
  const rows = await designerEntries(userId);
  const byContest = new Map<string, EntryRow[]>();
  for (const e of rows) byContest.set(e.contest.id, [...(byContest.get(e.contest.id) ?? []), e]);
  const urls = await coverUrls(rows.map((e) => e.coverPath));
  return [...byContest.values()].map((list) => {
    const winner = list.find((e) => e.status === "winner");
    return {
      slug: list[0].contest.slug,
      brandName: list[0].contest.brandName,
      status: list[0].contest.status,
      myEntries: list.length,
      won: Boolean(winner),
      winningLogoUrl: winner?.coverPath ? (urls.get(winner.coverPath) ?? null) : null,
      latestCoverUrl: list[0].coverPath ? (urls.get(list[0].coverPath) ?? null) : null,
    };
  });
}

export type PublicDesign = {
  contestSlug: string;
  brandName: string;
  number: number;
  isWinner: boolean;
  rating: number | null;
  coverUrl: string | null;
  imageCount: number;
};

/** P-06 tabs: the designer's public designs (winners first), each with its stars. */
export async function publicDesigns(designerId: string): Promise<PublicDesign[]> {
  const rows = (await designerEntries(designerId)).filter(isPublic);
  const urls = await coverUrls(rows.map((e) => e.coverPath));
  return rows
    .map((e) => ({
      contestSlug: e.contest.slug,
      brandName: e.contest.brandName,
      number: e.number,
      isWinner: e.status === "winner",
      rating: e.rating,
      coverUrl: e.coverPath ? (urls.get(e.coverPath) ?? null) : null,
      imageCount: e.imageCount,
    }))
    .sort((a, b) => Number(b.isWinner) - Number(a.isWinner));
}
