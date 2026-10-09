import { AdminShell } from "@/components/admin/admin-nav";
import { navFor, type AdminBadge } from "@/lib/admin/nav";
import { hasPermission } from "@/lib/admin/permissions";
import type { CurrentUser } from "@/lib/auth/policies";
import { authorize } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Badge counts, only for the queues this admin may see. */
async function queueCounts(user: CurrentUser): Promise<Record<AdminBadge, number>> {
  const zero = { reports: 0, claims: 0, withdrawals: 0, support: 0 };
  if (!isSupabaseConfigured()) return zero;
  const db = createAdminClient();
  const head = { count: "exact" as const, head: true };
  const [r, c, w, s] = await Promise.all([
    hasPermission(user, "reports.view") ? db.from("reports").select("id", head).eq("status", "open") : null,
    hasPermission(user, "claims.view") ? db.from("copy_claims").select("id", head).eq("status", "open") : null,
    hasPermission(user, "withdrawals.view") ? db.from("withdrawals").select("id", head).eq("status", "requested") : null,
    hasPermission(user, "support.view") ? db.from("support_threads").select("id", head).eq("status", "open").gt("unread_by_admin", 0) : null,
  ]);
  return { reports: r?.count ?? 0, claims: c?.count ?? 0, withdrawals: w?.count ?? 0, support: s?.count ?? 0 };
}

// Admin area (BLUEPRINT §13, §13.2): its own top bar and grouped sidebar; items follow the admin's permissions.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await authorize("admin.access");
  const counts = await queueCounts(user);
  return (
    <AdminShell groups={navFor(user)} counts={counts} me={{ name: user.name, title: user.adminTitle, isSuper: user.isSuperAdmin, permissions: user.adminPermissions }}>
      {children}
    </AdminShell>
  );
}
