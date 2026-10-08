import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { leadingDesigns, type ContestCover } from "@/lib/entries/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessType, PackageKey } from "./brief";
import { countEntries } from "./browse";

/** C-13 client dashboard (UI-JOURNEY, owner 2026-10-08). */

export const DASHBOARD_TABS = ["active", "drafts", "completed"] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];

const TAB_OF: Record<string, DashboardTab> = {
  open: "active",
  judging: "active",
  winner_selected: "active",
  handover: "active",
  draft: "drafts",
  pending_payment: "drafts",
  completed: "completed",
  no_result: "completed",
  cancelled: "completed",
};

export type DashboardContest = {
  id: string;
  slug: string;
  status: string;
  tab: DashboardTab;
  brandName: string;
  businessType: BusinessType;
  package: PackageKey;
  prize: number;
  total: number;
  /** Paid for this contest so far: the contest itself plus any extensions. */
  paid: number;
  isBlind: boolean;
  isPrivate: boolean;
  isPromoted: boolean;
  /** Running contest number (null until published). */
  number: number | null;
  isHighlighted: boolean;
  isUrgent: boolean;
  isNda: boolean;
  logoScan: boolean;
  createdAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  judgingEndsAt: Date | null;
  completedAt: Date | null;
  entries: number;
  designers: number;
  /** The leading design (winner, best rated or newest), shown instead of the brand letter. */
  cover: ContestCover | null;
  /** Active designs the client hasn't rated yet (owner, 2026-10-08: "needs your attention"). */
  unrated: number;
  /** TODO(milestone 5): the winning entry's logo and designer once winners can be picked. */
  winner: { logoUrl: string; designer: string } | null;
};

export type ClientDashboard = {
  profile: { name: string; businessName: string | null; memberSince: Date };
  stats: { contestsRun: number; totalSpent: number; active: number; completed: number };
  contests: DashboardContest[];
};

const date = (v: string | null) => (v ? new Date(v) : null);

export async function getClientDashboard(userId: string): Promise<ClientDashboard> {
  const empty: ClientDashboard = {
    profile: { name: "", businessName: null, memberSince: new Date() },
    stats: { contestsRun: 0, totalSpent: 0, active: 0, completed: 0 },
    contests: [],
  };
  if (!isSupabaseConfigured()) return empty;
  const db = createAdminClient();

  const [{ data: profile }, { data: rows, error }, { data: payments }] = await Promise.all([
    db.from("profiles").select("name, business_name, created_at").eq("id", userId).single(),
    db
      .from("contests")
      .select(
        "id, slug, status, brand_name, business_type, package, prize_amount, total_amount, is_blind, is_private, is_promoted, is_highlighted, is_urgent, is_nda, contest_number, logo_scan, created_at, starts_at, ends_at, judging_ends_at, completed_at",
      )
      .eq("client_id", userId)
      .order("created_at", { ascending: false }),
    db.from("payments").select("contest_id, purpose, amount").eq("client_id", userId).eq("status", "paid"),
  ]);
  if (error) throw new Error(error.message);

  // Total spent = every paid payment (BLUEPRINT §8.4), same number as the public profile.
  const paidByContest = new Map<string, number>();
  const contestsPaidFor = new Set<string>();
  let totalSpent = 0;
  for (const p of payments ?? []) {
    totalSpent += p.amount as number;
    paidByContest.set(p.contest_id as string, (paidByContest.get(p.contest_id as string) ?? 0) + (p.amount as number));
    if (p.purpose === "contest") contestsPaidFor.add(p.contest_id as string);
  }

  const list = rows ?? [];
  const [entries, covers, entryRows] = await Promise.all([
    countEntries(list.map((r) => r.id as string)),
    // The client's own contests: blind and private ones show their designs too.
    leadingDesigns(list.map((r) => ({ id: r.id as string, isBlind: r.is_blind as boolean, isPrivate: r.is_private as boolean })), true),
    list.length
      ? db.from("entries").select("contest_id, designer_id, rating, status").in("contest_id", list.map((r) => r.id as string)).in("status", ["active", "winner", "forfeited"])
      : Promise.resolve({ data: [] as { contest_id: string; designer_id: string; rating: number | null; status: string }[] }),
  ]);
  const designersBy = new Map<string, Set<string>>();
  const unratedBy = new Map<string, number>();
  for (const e of (entryRows.data ?? []) as { contest_id: string; designer_id: string; rating: number | null; status: string }[]) {
    designersBy.set(e.contest_id, (designersBy.get(e.contest_id) ?? new Set()).add(e.designer_id));
    if (e.status === "active" && !e.rating) unratedBy.set(e.contest_id, (unratedBy.get(e.contest_id) ?? 0) + 1);
  }
  const contests: DashboardContest[] = list.map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status,
    tab: TAB_OF[r.status] ?? "completed",
    brandName: r.brand_name,
    businessType: r.business_type as BusinessType,
    package: r.package as PackageKey,
    prize: r.prize_amount,
    total: r.total_amount,
    paid: paidByContest.get(r.id) ?? 0,
    isBlind: r.is_blind,
    isPrivate: r.is_private,
    isPromoted: r.is_promoted,
    number: (r.contest_number as number | null) ?? null,
    isHighlighted: Boolean(r.is_highlighted),
    isUrgent: Boolean(r.is_urgent),
    isNda: Boolean(r.is_nda),
    logoScan: Boolean(r.logo_scan),
    createdAt: new Date(r.created_at),
    startsAt: date(r.starts_at),
    endsAt: date(r.ends_at),
    judgingEndsAt: date(r.judging_ends_at),
    completedAt: date(r.completed_at),
    entries: entries.get(r.id) ?? 0,
    designers: designersBy.get(r.id)?.size ?? 0,
    cover: covers.get(r.id) ?? null,
    unrated: unratedBy.get(r.id) ?? 0,
    winner: null,
  }));

  return {
    profile: {
      name: profile?.name ?? "",
      businessName: profile?.business_name ?? null,
      memberSince: new Date(profile?.created_at ?? Date.now()),
    },
    stats: {
      contestsRun: contestsPaidFor.size,
      totalSpent,
      active: contests.filter((c) => c.tab === "active").length,
      completed: contests.filter((c) => c.status === "completed").length,
    },
    contests,
  };
}

/** Contests of this client that are live or being judged (client home P-01c). */
export async function countRunningContests(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await createAdminClient().from("contests").select("id", { count: "exact", head: true }).eq("client_id", userId).in("status", ["open", "judging"]);
  return count ?? 0;
}
