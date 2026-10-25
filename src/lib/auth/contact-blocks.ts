import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A phone or email the team blocked from starting new contests (Admin › Unpaid contests › Close as fake, owner
 * 2026-10-25; migration 0076). `mobile` in E.164, `email` as normalizeEmail gives it. Before the migration, or if the
 * check can't run, nobody is blocked: a contest is never lost to a database hiccup.
 */
export async function contactBlocked({ mobile, email }: { mobile?: string | null; email?: string | null }): Promise<boolean> {
  const wanted = [...(mobile ? [["mobile", mobile]] : []), ...(email ? [["email", email.trim().toLowerCase()]] : [])] as [string, string][];
  if (!wanted.length || !isSupabaseConfigured()) return false;
  const { data, error } = await createAdminClient()
    .from("blocked_contacts")
    .select("kind, value")
    .in("value", wanted.map(([, v]) => v))
    .is("lifted_at", null);
  if (error) return false;
  return (data ?? []).some((b) => wanted.some(([k, v]) => b.kind === k && b.value === v));
}
