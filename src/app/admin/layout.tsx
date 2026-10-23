import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-nav";
import { menuTodoCounts } from "@/lib/admin/badges";
import { navFor } from "@/lib/admin/nav";
import { hasPermission } from "@/lib/admin/permissions";
import { authorize } from "@/lib/auth/session";

/** The top-bar search covers these lists (admin/search). */
const SEARCH_AREAS = ["contests.view", "users.view", "payments.view"] as const;

// The admin panel can be added to a phone's Home Screen (owner, 2026-10-22): iPhones show its notifications only then.
export const metadata: Metadata = { manifest: "/admin-app.webmanifest" };

// Admin area (BLUEPRINT §13, §13.2; design/admin, owner 2026-10-10): sidebar, top bar with search, activity and
// account menu; items follow the admin's permissions.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await authorize("admin.access");
  // Red counts for work waiting (owner, 2026-10-23); the gold "new" counts load in the browser.
  const todo = await menuTodoCounts(user);
  return (
    <AdminShell
      groups={navFor(user)}
      todo={todo}
      me={{ name: user.name, title: user.adminTitle, isSuper: user.isSuperAdmin, permissions: user.adminPermissions }}
      canSearch={SEARCH_AREAS.some((p) => hasPermission(user, p))}
      canSeeActivity={hasPermission(user, "dashboard.view")}
    >
      {children}
    </AdminShell>
  );
}
