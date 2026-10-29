import "server-only";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/contests/brief";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { refundedTotal } from "@/lib/guarantee/queries";
import { avatarUrl } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { offersOn } from "./program";
import { monthRange } from "./rules";

/** Winners gallery, home logos, the designer badge and client profiles (BLUEPRINT §8.4, §11). */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/**
 * Months a designer won the monthly gift box, newest first (for the profile badge; owner, 2026-10-11). Only real
 * months whose card went out.
 */
export async function championMonths(designerId: string): Promise<string[]> {
  // Owner, 2026-10-13: champion badges hide while the monthly prizes program is off.
  if (!isSupabaseConfigured() || !(await offersOn()).program) return [];
  const { data } = await createAdminClient()
    .from("monthly_rewards")
    .select("month")
    .eq("winner_id", designerId)
    .eq("kind", "gift_box")
    .eq("is_test", false)
    .not("sent_at", "is", null)
    .order("month", { ascending: false });
  return (data ?? []).map((r) => r.month as string);
}

// ---------------------------------------------------------------------------------------------
// Winning designs: winners gallery and home logos
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
  rating: number | null;
  finishedAt: Date;
};

/**
 * Winning designs anyone may see: completed public contests, never private or NDA, blind only when the client
 * made the winner public. Optional filters: the month the contest finished (Bangladesh time) and business type.
 */
export async function winningDesigns(q: { month?: string | null; type?: string | null; limit?: number; entryIds?: string[]; strict?: boolean }): Promise<WinningDesign[]> {
  if (!isSupabaseConfigured()) return [];
  let query = createAdminClient()
    .from("entries")
    .select(
      "id, number, rating, designer_id, designer:profiles!designer_id(id, name, username, avatar_path), contest:contests!contest_id!inner(slug, brand_name, business_type, status, is_private, is_nda, is_blind, winner_is_public, completed_at, owner:profiles!client_id!inner(is_test)), images:entry_images!entry_id(position, preview_path)",
    )
    .eq("status", "winner")
    .eq("contest.status", "completed")
    .eq("contest.is_private", false)
    .eq("contest.is_nda", false)
    // Never a test client's contest (owner, 2026-10-22).
    .eq("contest.owner.is_test", false)
    .limit(1000);
  if (q.month) {
    const { start, end } = monthRange(q.month);
    query = query.gte("contest.completed_at", start.toISOString()).lt("contest.completed_at", end.toISOString());
  }
  if (q.type && (BUSINESS_TYPES as readonly string[]).includes(q.type)) query = query.eq("contest.business_type", q.type);
  if (q.entryIds) query = query.in("id", q.entryIds.length ? q.entryIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await query;
  // The home page's cached list (owner, 2026-10-29) must not keep an empty answer from a failed read.
  if (error && q.strict) throw new Error(error.message);
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
        rating: r.rating,
        finishedAt: new Date(r.contest.completed_at ?? 0),
      };
    });
  // Newest first.
  const designs = mapped.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime()).slice(0, q.limit ?? 60);
  const paths = designs.map((d) => d.coverUrl).filter((p): p is string => Boolean(p));
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, paths, 3600, { width: 640 })
    .catch(() => new Map<string, string>());
  return designs.map((d) => ({ ...d, coverUrl: d.coverUrl ? (urls.get(d.coverUrl) ?? null) : null }));
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
  if (!p || p.status === "banned" || p.status === "deleted") return null;
  const [payments, contests, back] = await Promise.all([
    db.from("payments").select("amount").eq("client_id", p.id).eq("status", "paid"),
    db.from("contests").select("id, is_private, is_nda").eq("client_id", p.id).in("status", PAID_STATUSES).order("starts_at", { ascending: false }),
    refundedTotal(p.id as string),
  ]);
  return {
    id: p.id as string,
    name: p.name as string,
    businessName: (p.business_name as string | null) ?? null,
    avatarUrl: avatarUrl(p.avatar_path as string | null),
    memberSince: new Date(p.created_at as string),
    // Total spent includes private contests (§8.4); only the list hides them.
    // Less what came back under the money-back guarantee (owner, 2026-10-21).
    totalSpent: Math.max(0, (payments.data ?? []).reduce((s, r) => s + (r.amount as number), 0) - back),
    contestsCount: contests.data?.length ?? 0,
    publicContestIds: (contests.data ?? []).filter((c) => !c.is_private && !c.is_nda).map((c) => c.id as string),
  };
}
