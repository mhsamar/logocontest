"use server";

import { adminUser } from "@/lib/admin/core";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;

/** A-13: an admin opens a designer's full ID number. Every reveal is written to the audit log (§9.6). */
export async function revealIdNumber(designerId: string): Promise<{ ok: true; idNumber: string } | { ok: false }> {
  // Full ID numbers need the Agreements "manage" permission (BLUEPRINT §13.2).
  const user = await adminUser("agreements.manage");
  if (!user || !UUID.test(designerId)) return { ok: false };
  const db = createAdminClient();
  const { data } = await db.from("designer_agreements").select("id_number").eq("designer_id", designerId).maybeSingle();
  if (!data) return { ok: false };
  const { error } = await db.from("audit_logs").insert({ admin_id: user.id, action: "reveal_id_number", subject_type: "designer_agreement", subject_id: designerId });
  if (error) return { ok: false }; // no log, no number
  return { ok: true, idNumber: data.id_number as string };
}
