import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * New clients who gave their mobile number on the wizard's first step but haven't signed up (owner, 2026-10-14),
 * newest first. A number that now belongs to an account is left out. Before migration 0052: none.
 */
export type WizardLead = { mobile: string; brand: string | null; service: string | null; step: number; updatedAt: Date; createdAt: Date };

export async function wizardLeads(limit = 40): Promise<WizardLead[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data, error } = await db.from("wizard_leads").select("mobile, brand_name, service, furthest_step, updated_at, created_at").order("updated_at", { ascending: false }).limit(200);
  if (error || !data?.length) return [];
  const mobiles = [...new Set(data.map((r) => r.mobile as string))];
  const { data: accounts } = await db.from("profiles").select("mobile").in("mobile", mobiles);
  const signedUp = new Set((accounts ?? []).map((a) => a.mobile as string));
  const seen = new Set<string>();
  const out: WizardLead[] = [];
  for (const r of data) {
    const m = r.mobile as string;
    if (signedUp.has(m) || seen.has(m)) continue;
    seen.add(m);
    out.push({ mobile: m, brand: (r.brand_name as string | null) ?? null, service: (r.service as string | null) ?? null, step: r.furthest_step as number, updatedAt: new Date(r.updated_at as string), createdAt: new Date(r.created_at as string) });
    if (out.length >= limit) break;
  }
  return out;
}
