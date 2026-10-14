"use server";

import { isSupabaseConfigured } from "@/lib/env";
import { toE164 } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Wizard drop-off (BLUEPRINT §13, owner 2026-10-09): the furthest step an anonymous visit reached.
 * Step 12 = went on to payment. No personal data. Never throws.
 */
export async function recordWizardStep(visitId: string, step: number, contestId: string | null): Promise<void> {
  if (!isSupabaseConfigured() || !UUID.test(visitId) || !Number.isInteger(step) || step < 1 || step > 12) return;
  const { error } = await createAdminClient().rpc("record_wizard_step", { p_visit_id: visitId, p_step: step, p_contest_id: contestId && UUID.test(contestId) ? contestId : null });
  if (error) console.error("[wizard-tracking]", error.message);
  // How far a new client with a saved mobile number got (owner, 2026-10-14). No row for this visit: nothing changes.
  await createAdminClient().from("wizard_leads").update({ furthest_step: step, updated_at: new Date().toISOString() }).eq("visit_id", visitId).lt("furthest_step", step);
}

/**
 * A new client's mobile number from the first step of the wizard (owner, 2026-10-14), so the team can call someone
 * who started but didn't finish signing up. Kept 90 days. Never throws.
 */
export async function saveWizardLead(input: { visitId: string; mobile: string; country?: string; brandName?: string; service?: string }): Promise<void> {
  if (!isSupabaseConfigured() || !UUID.test(input.visitId)) return;
  const mobile = toE164(input.mobile ?? "", input.country);
  if (!mobile) return;
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("wizard_leads")
    .upsert(
      { visit_id: input.visitId, mobile, brand_name: (input.brandName ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null, service: (input.service ?? "logo").slice(0, 60), updated_at: now },
      { onConflict: "visit_id" },
    );
  if (error) console.error("[wizard-lead]", error.message);
}
