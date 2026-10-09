"use server";

import { isSupabaseConfigured } from "@/lib/env";
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
}
