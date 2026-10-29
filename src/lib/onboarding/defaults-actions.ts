"use server";

/**
 * Admin › Onboarding › Brief defaults (owner, 2026-10-29; client-onboarding-v2-spec.md §3): the brief a new onboarding
 * v2 contest starts with, per business type, kept in the setting onboarding.brief_defaults. Same permission and audit
 * as the rest of the page (saveOnboarding: Content · manage).
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { adminUser, audit } from "@/lib/admin/core";
import { BUSINESS_TYPES, DELIVERABLES, LOGO_STYLES, REQUIREMENTS, USED_ON, type BusinessType } from "@/lib/contests/brief";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSetting, settingsChanged } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BriefDefault } from "./brief-defaults";

const KEY = "onboarding.brief_defaults";

type Result = { ok: true } | { ok: false; error: MessageKey };

// The shape brief-defaults.ts reads (its BriefDefaultShape), so a saved entry is always used and never falls back.
// Repeats are dropped; the owner's order is kept.
const slider = z.number().int().min(1).max(5);
const list = <T extends readonly [string, ...string[]]>(values: T) => z.array(z.enum(values)).max(values.length).transform((a) => [...new Set(a)]);
const Entry = z.object({
  styles: list(LOGO_STYLES),
  sliders: z.object({ complexity: slider, era: slider, tone: slider }),
  usedOn: list(USED_ON),
  deliverables: list(DELIVERABLES),
  requirements: list(REQUIREMENTS),
});

export type BriefDefaultsCheck = { entries: Partial<Record<BusinessType, BriefDefault>>; bad: BusinessType[] };

/**
 * The valid entries, in business-type order (keys that aren't a business type are dropped), and the business types
 * whose entry is broken. Pure (no reads or writes): Admin › Onboarding also uses it to show which types have their own.
 */
export async function checkBriefDefaults(raw: unknown): Promise<BriefDefaultsCheck> {
  const all = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: BriefDefaultsCheck = { entries: {}, bad: [] };
  for (const type of BUSINESS_TYPES) {
    if (all[type] === undefined) continue;
    const parsed = Entry.safeParse(all[type]);
    if (parsed.success) out.entries[type] = parsed.data;
    else out.bad.push(type);
  }
  return out;
}

/** Saves every business type's own defaults; a type left out uses "other", which must always be there. */
export async function saveBriefDefaults(raw: unknown): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const { entries, bad } = await checkBriefDefaults(raw);
  if (bad.length > 0 || !entries.other) return { ok: false, error: "admin.errors.generic" };
  const before = await getSetting(KEY);
  const def = SETTINGS[KEY];
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: KEY, value: entries, type: def.type, group: def.group, description: def.description, updated_by: admin.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  settingsChanged();
  if (error) return { ok: false, error: "auth.errors.generic" };
  await audit(admin.id, "update_brief_defaults", "settings", KEY, { from: before, to: entries });
  refresh();
  return { ok: true };
}
