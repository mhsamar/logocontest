import "server-only";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/contests/brief";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { likesFor } from "./likes";
import { monthKey, monthRange, rankDesigns } from "./rules";

/** Leaderboard, Monthly Winner, winners gallery and client profiles (BLUEPRINT §8.4, §11; owner 2026-10-09). */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Months a designer was confirmed Monthly Winner, newest first (for the badge). */
export async function championMonths(designerId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("monthly_winners").select("month").eq("designer_id", designerId).eq("status", "confirmed").order("month", { ascending: false });
  return (data ?? []).map((r) => r.month as string);
}

export const thisMonth = () => monthKey(new Date());

// ---------------------------------------------------------------------------------------------
// Winning designs with likes: leaderboard, winners gallery, Monthly Winner (owner, 2026-10-09)
// ---------------------------------------------------------------------------------------------

export type WinningDesign = {
  entryId: string;
  number: number;
  contestSlug: string;
  brandName: string;
  businessType: BusinessType;
  /** Null for a blind contest's winner (shown only once the client made it public, but the name stays off). */
  designer: { id: string; name: string; username: string | null; avatarUrl: string | null } | null;
  designerId: string;
  coverUrl: string | null;
  likes: number;
  liked: boolean;
  rating: number | null;
  finishedAt: Date;
};

/**
 * Winning designs anyone may see: completed public contests, never private or NDA, blind only when the client
 * made the winner public. Optional filters: the month the contest finished (Bangladesh time) and business type.
 */
export async function winningDesigns(q: { month?: string | null; type?: string | null; viewerId?: string | null; limit?: number; entryIds?: string[]; order?: "likes" | "newest" }): Promise<WinningDesign[]> {
  if (!isSupabaseConfigured()) return [];
  let query = createAdminClient()
    .from("entries")
    .select(
      "id, number, rating, designer_id, designer:profiles!designer_id(id, name, username, avatar_path), contest:contests!contest_id!inner(slug, brand_name, business_type, status, is_private, is_nda, is_blind, winner_is_public, completed_at), images:entry_images!entry_id(position, preview_path)",
    )
    .eq("status", "winner")
    .eq("contest.status", "completed")
    .eq("contest.is_private", false)
    .eq("contest.is_nda", false)
    .limit(1000);
  if (q.month) {
    const { start, end } = monthRange(q.month);
    query = query.gte("contest.completed_at", start.toISOString()).lt("contest.completed_at", end.toISOString());
  }
  if (q.type && (BUSINESS_TYPES as readonly string[]).includes(q.type)) query = query.eq("contest.business_type", q.type);
  if (q.entryIds) query = query.in("id", q.entryIds.length ? q.entryIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await query;
  type Row = {
    id: string;
    number: number;
    rating: number | null;
    designer_id: string;
    designer: unknown;
    contest: { slug: string; brand_name: string; business_type: BusinessType; is_blind: boolean; winner_is_public: boolean; completed_at: string | null };
    images: { position: number; preview_path: string }[] | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => !r.contest.is_blind || r.contest.winner_is_public);
  const { counts, mine } = await likesFor(
    rows.map((r) => r.id),
    q.viewerId ?? null,
  );
  const mapped =
    rows.map((r) => {
      const d = one(r.designer as { id: string; name: string; username: string | null; avatar_path: string | null } | null);
      return {
        entryId: r.id,
        number: r.number,
        contestSlug: r.contest.slug,
        brandName: r.contest.brand_name,
        businessType: r.contest.business_type,
        designer: d && !r.contest.is_blind ? { id: d.id, name: d.name, username: d.username, avatarUrl: avatarUrl(d.avatar_path) } : null,
        designerId: r.designer_id,
        coverUrl: [...(r.images ?? [])].sort((a, b) => a.position - b.position)[0]?.preview_path ?? null,
        likes: counts.get(r.id) ?? 0,
        liked: mine.has(r.id),
        rating: r.rating,
        finishedAt: new Date(r.contest.completed_at ?? 0),
      };
    });
  const ordered = q.order === "newest" ? mapped.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime()) : rankDesigns(mapped);
  const designs = ordered.slice(0, q.limit ?? 60);
  const paths = designs.map((d) => d.coverUrl).filter((p): p is string => Boolean(p));
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, paths, 3600)
    .catch(() => new Map<string, string>());
  return designs.map((d) => ({ ...d, coverUrl: d.coverUrl ? (urls.get(d.coverUrl) ?? null) : null }));
}

export type MonthlyRecord = {
  month: string;
  entryId: string | null;
  designerId: string;
  likes: number;
  status: "proposed" | "confirmed";
  giftStatus: "awaiting_address" | "address_given" | "sent" | null;
  ship: { name: string | null; phone: string | null; address: string | null };
  sentAt: Date | null;
  sentNote: string | null;
  confirmedAt: Date | null;
};

const MW_COLUMNS = "month, entry_id, designer_id, likes, status, gift_status, ship_name, ship_phone, ship_address, sent_at, sent_note, confirmed_at";
const toRecord = (r: Record<string, unknown>): MonthlyRecord => ({
  month: r.month as string,
  entryId: (r.entry_id as string | null) ?? null,
  designerId: r.designer_id as string,
  likes: (r.likes as number) ?? 0,
  status: r.status as MonthlyRecord["status"],
  giftStatus: (r.gift_status as MonthlyRecord["giftStatus"]) ?? null,
  ship: { name: (r.ship_name as string | null) ?? null, phone: (r.ship_phone as string | null) ?? null, address: (r.ship_address as string | null) ?? null },
  sentAt: r.sent_at ? new Date(r.sent_at as string) : null,
  sentNote: (r.sent_note as string | null) ?? null,
  confirmedAt: r.confirmed_at ? new Date(r.confirmed_at as string) : null,
});

export async function monthRecord(month: string): Promise<MonthlyRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("monthly_winners").select(MW_COLUMNS).eq("month", month).maybeSingle();
  return data ? toRecord(data) : null;
}

/** A designer's own confirmed months (for the gift form). */
export async function myMonthlyWins(designerId: string): Promise<MonthlyRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("monthly_winners").select(MW_COLUMNS).eq("designer_id", designerId).eq("status", "confirmed").order("month", { ascending: false });
  return (data ?? []).map(toRecord);
}

/** Confirmed Monthly Winners with their designs, newest first. */
export async function pastWinners(limit = 12): Promise<{ month: string; design: WinningDesign }[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("monthly_winners").select("month, entry_id").eq("status", "confirmed").not("entry_id", "is", null).order("month", { ascending: false }).limit(limit);
  const designs = await winningDesigns({ entryIds: (data ?? []).map((r) => r.entry_id as string), limit: 1000 });
  const byId = new Map(designs.map((d) => [d.entryId, d]));
  return (data ?? []).filter((r) => byId.has(r.entry_id as string)).map((r) => ({ month: r.month as string, design: byId.get(r.entry_id as string)! }));
}

// ---------------------------------------------------------------------------------------------
// P-12 Client public profile
// ---------------------------------------------------------------------------------------------

export type ClientProfile = { id: string; name: string; businessName: string | null; avatarUrl: string | null; memberSince: Date; totalSpent: number; contestsCount: number; publicContestIds: string[] };

const PAID_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

export async function clientByUsername(username: string): Promise<ClientProfile | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9_-]{3,40}$/i.test(username)) return null;
  const db = createAdminClient();
  const { data: p } = await db.from("profiles").select("id, name, business_name, avatar_path, created_at, status").eq("username", username.toLowerCase()).eq("role", "client").maybeSingle();
  if (!p || p.status === "banned") return null;
  const [payments, contests] = await Promise.all([
    db.from("payments").select("amount").eq("client_id", p.id).eq("status", "paid"),
    db.from("contests").select("id, is_private, is_nda").eq("client_id", p.id).in("status", PAID_STATUSES).order("starts_at", { ascending: false }),
  ]);
  return {
    id: p.id as string,
    name: p.name as string,
    businessName: (p.business_name as string | null) ?? null,
    avatarUrl: avatarUrl(p.avatar_path as string | null),
    memberSince: new Date(p.created_at as string),
    // Total spent includes private contests (§8.4); only the list hides them.
    totalSpent: (payments.data ?? []).reduce((s, r) => s + (r.amount as number), 0),
    contestsCount: contests.data?.length ?? 0,
    publicContestIds: (contests.data ?? []).filter((c) => !c.is_private && !c.is_nda).map((c) => c.id as string),
  };
}
