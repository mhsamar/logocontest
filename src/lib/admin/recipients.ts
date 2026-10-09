import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, type Permission } from "./permissions";

/** Active admins who may see this area: who gets an admin notification (BLUEPRINT §13.2). */
export async function adminIdsWith(perm: Permission): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, role, status, is_super_admin, admin_active, admin_permissions")
    .eq("role", "admin")
    .eq("status", "active");
  return (data ?? [])
    .filter((r) => hasPermission({ role: r.role, status: r.status, isSuperAdmin: !!r.is_super_admin, adminActive: r.admin_active !== false, adminPermissions: r.admin_permissions ?? [] }, perm))
    .map((r) => r.id as string);
}
