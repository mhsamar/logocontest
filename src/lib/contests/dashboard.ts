import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
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
  createdAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  judgingEndsAt: Date | null;
  completedAt: Date | null;
  entries: number;
  designers: number;
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
        "id, slug, status, brand_name, business_type, package, prize_amount, total_amount, is_blind, is_private, is_promoted, created_at, starts_at, ends_at, judging_ends_at, completed_at",
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
  const entries = await countEntries(list.map((r) => r.id as string));
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
    createdAt: new Date(r.created_at),
    startsAt: date(r.starts_at),
    endsAt: date(r.ends_at),
    judgingEndsAt: date(r.judging_ends_at),
    completedAt: date(r.completed_at),
    entries: entries.get(r.id) ?? 0,
    designers: 0, // TODO(milestone 4): distinct designers with entries
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
