import "server-only";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

/** The signed-in admin, or null. Every admin action starts here. */
export async function adminUser() {
  const user = await getCurrentUser();
  return can(user, "admin.access") && user ? user : null;
}

/** Writes one row to the audit log (BLUEPRINT §13.12). Never throws: a failed log is reported, not fatal. */
export async function audit(adminId: string, action: string, subjectType: string, subjectId: string | null, changes: Record<string, unknown> = {}): Promise<void> {
  const { error } = await createAdminClient().from("audit_logs").insert({ admin_id: adminId, action, subject_type: subjectType, subject_id: subjectId, changes });
  if (error) console.error("[audit] insert failed:", error.message);
}

/** A reason the admin typed: trimmed, 3–500 characters, or null. */
export function cleanReason(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length >= 3 && s.length <= 500 ? s : null;
}

export const UUID = /^[0-9a-f-]{36}$/i;
export const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
