"use server";

import { activityFeed, dhakaStart, type ActivityKind } from "./analytics";
import { adminUser } from "./core";
import { dashboardStats } from "./dashboard";

export type RecentActivity = {
  stats: { live: number; revenue: number; withdrawals: number; reports: number };
  items: { kind: ActivityKind; at: string; name: string | null; label: string; href: string | null }[];
};

/**
 * The bell's "Recent activity" drawer (design/admin/shell-activity-drawer-open.html): last-30-day numbers and
 * the newest activity. Loaded only when the drawer opens; needs the Dashboard permission.
 */
export async function loadRecentActivity(): Promise<RecentActivity | null> {
  if (!(await adminUser("dashboard.view"))) return null;
  const [s, feed] = await Promise.all([dashboardStats({ since: dhakaStart(29), until: null }), activityFeed(8)]);
  if (!s) return null;
  return {
    stats: { live: s.contestsLive, revenue: s.revenue.total, withdrawals: s.pendingWithdrawals.count, reports: s.openReports + s.openClaims },
    items: feed.slice(0, 8).map((a) => ({ kind: a.kind, at: a.at.toISOString(), name: a.person?.name ?? null, label: a.label, href: a.href })),
  };
}
