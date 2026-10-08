import "server-only";
import { PUBLIC_STATUSES } from "@/lib/contests/public-statuses";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isPublicDesign, SHOWN_STATUSES, type EntryStatus } from "@/lib/entries/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { startOfDhakaDay, STUDIO_PAGE_SIZE, type StudioFilter } from "./options";

/** Design Studio (UI-JOURNEY P-13): every public design, newest first, one tile each. */

export type StudioDesign = {
  id: string;
  contestSlug: string;
  brandName: string;
  number: number;
  isWinner: boolean;
  /** Null in blind contests. */
  designer: { name: string; username: string | null } | null;
  /** Signed link to the first mockup's preview. */
  coverUrl: string | null;
  imageCount: number;
  createdAt: string;
};

export type StudioPage = { designs: StudioDesign[]; nextCursor: string | null };

export type StudioStats = { designs: number; today: number; winners: number };

type Row = {
  id: string;
  number: number;
  status: EntryStatus;
  created_at: string;
  designer: { name: string; username: string | null } | { name: string; username: string | null }[] | null;
  contest: { slug: string; brand_name: string; status: string; is_private: boolean; is_blind: boolean; winner_is_public: boolean };
  images: { position: number; preview_path: string }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

// Rows are read in batches and filtered by isPublicDesign (blind contests can't be filtered in one query).
const BATCH = STUDIO_PAGE_SIZE * 3;

export async function listStudio({ filter, before }: { filter: StudioFilter; before?: string | null }): Promise<StudioPage> {
  if (!isSupabaseConfigured()) return { designs: [], nextCursor: null };
  let query = createAdminClient()
    .from("entries")
    .select(
      "id, number, status, created_at, designer:profiles!designer_id(name, username), contest:contests!contest_id!inner(slug, brand_name, status, is_private, is_blind, winner_is_public), images:entry_images!entry_id(position, preview_path)",
    )
    .in("status", filter === "winners" ? ["winner"] : SHOWN_STATUSES)
    .eq("contest.is_private", false)
    .in("contest.status", [...PUBLIC_STATUSES])
    .order("created_at", { ascending: false })
    .limit(BATCH);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const raw = (data ?? []) as unknown as Row[];

  const picked: Row[] = [];
  let last = -1;
  for (let i = 0; i < raw.length && picked.length < STUDIO_PAGE_SIZE; i++) {
    last = i;
    const r = raw[i];
    const c = r.contest;
    if (isPublicDesign(r, { status: c.status, isPrivate: c.is_private, isBlind: c.is_blind, winnerIsPublic: c.winner_is_public })) picked.push(r);
  }
  const more = last < raw.length - 1 || raw.length === BATCH;
  const nextCursor = more && last >= 0 ? raw[last].created_at : null;

  const covers = picked.map((r) => [...(r.images ?? [])].sort((a, b) => a.position - b.position)[0]?.preview_path ?? null);
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, covers.filter((p): p is string => Boolean(p)), 3600)
    .catch(() => new Map<string, string>());

  return {
    designs: picked.map((r, i) => ({
      id: r.id,
      contestSlug: r.contest.slug,
      brandName: r.contest.brand_name,
      number: r.number,
      isWinner: r.status === "winner",
      designer: r.contest.is_blind ? null : one(r.designer),
      coverUrl: covers[i] ? (urls.get(covers[i]!) ?? null) : null,
      imageCount: r.images?.length ?? 0,
      createdAt: r.created_at,
    })),
    nextCursor,
  };
}

/** Real counts for the banner: public designs, new today and winners (same rule as isPublicDesign). */
export async function studioStats(): Promise<StudioStats> {
  if (!isSupabaseConfigured()) return { designs: 0, today: 0, winners: 0 };
  const db = createAdminClient();
  const SELECT = "id, contest:contests!contest_id!inner(id)";
  const count = async (opts: { winnersOnly?: boolean; since?: string }) => {
    // Non-blind contests: every shown design. Blind contests: the public winner of a completed contest.
    let open = db
      .from("entries")
      .select(SELECT, { count: "exact", head: true })
      .in("status", opts.winnersOnly ? ["winner"] : SHOWN_STATUSES)
      .eq("contest.is_private", false)
      .eq("contest.is_blind", false)
      .in("contest.status", [...PUBLIC_STATUSES]);
    let blind = db
      .from("entries")
      .select(SELECT, { count: "exact", head: true })
      .eq("status", "winner")
      .eq("contest.is_private", false)
      .eq("contest.is_blind", true)
      .eq("contest.status", "completed")
      .eq("contest.winner_is_public", true);
    if (opts.since) {
      open = open.gte("created_at", opts.since);
      blind = blind.gte("created_at", opts.since);
    }
    const [a, b] = await Promise.all([open, blind]);
    if (a.error) throw new Error(a.error.message);
    if (b.error) throw new Error(b.error.message);
    return (a.count ?? 0) + (b.count ?? 0);
  };
  const [designs, today, winners] = await Promise.all([count({}), count({ since: startOfDhakaDay() }), count({ winnersOnly: true })]);
  return { designs, today, winners };
}
