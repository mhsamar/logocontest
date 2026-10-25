"use server";

import { contactBlocked } from "@/lib/auth/contact-blocks";
import { normalizeEmail } from "@/lib/auth/identity";
import { isSupabaseConfigured } from "@/lib/env";
import { toE164 } from "@/lib/phone";
import { isPersonName } from "@/lib/profile/name-rules";
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
 * who started but didn't finish signing up. With the name, email and WhatsApp tick from that step (owner,
 * 2026-10-25), so the team knows who they are calling. Kept 90 days. Never throws.
 */
export async function saveWizardLead(input: { visitId: string; mobile: string; country?: string; brandName?: string; service?: string; name?: string; email?: string; whatsapp?: boolean }): Promise<void> {
  if (!isSupabaseConfigured() || !UUID.test(input.visitId)) return;
  const mobile = toE164(input.mobile ?? "", input.country);
  if (!mobile) return;
  // A number the team closed as fake and blocked doesn't come back as a lead (owner, 2026-10-25).
  if (await contactBlocked({ mobile })) return;
  const now = new Date().toISOString();
  const row = { visit_id: input.visitId, mobile, brand_name: (input.brandName ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null, service: (input.service ?? "logo").slice(0, 60), updated_at: now };
  // Only what was given: the brand's later save keeps the name and email from the first step. Checked here as on the
  // form, since anyone can call this and the name reaches the team's bell and phone.
  const name = typeof input.name === "string" ? input.name.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  const email = typeof input.email === "string" ? normalizeEmail(input.email) : null;
  const details = {
    ...(name.length >= 2 && name.length <= 60 && isPersonName(name) ? { name } : {}),
    ...(email ? { email } : {}),
    ...(typeof input.whatsapp === "boolean" ? { whatsapp: input.whatsapp } : {}),
  };
  // A different number on the same visit is a new person for the team: their wait starts again. Before migration
  // 0075 this fails harmlessly (no alerted_at yet).
  await createAdminClient().from("wizard_leads").update({ alerted_at: null, created_at: now }).eq("visit_id", input.visitId).neq("mobile", mobile);
  const db = createAdminClient().from("wizard_leads");
  let { error } = await db.upsert({ ...row, ...details }, { onConflict: "visit_id" });
  // Before migration 0075 these columns don't exist yet: keep the number at least.
  if (error && Object.keys(details).length && (error.code === "PGRST204" || error.code === "42703")) ({ error } = await createAdminClient().from("wizard_leads").upsert(row, { onConflict: "visit_id" }));
  if (error) console.error("[wizard-lead]", error.message);
}
