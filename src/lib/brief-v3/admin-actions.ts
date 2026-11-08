"use server";

/**
 * Admin › Brief (owner, 2026-11-08): the new brief's switch, its business categories and suggestion templates, kept in
 * the settings brief.v3_on, brief.categories and brief.templates. Content · manage, audited like Admin › Onboarding.
 */
import { refresh } from "next/cache";
import { z } from "zod";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSettings, settingsChanged } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanBriefText, GENERAL } from "./rules";
import { BRIEF_CATEGORY_SCHEMA } from "./schema";

type Result = { ok: true } | { ok: false; error: MessageKey };

const Input = z.object({
  on: z.boolean(),
  categories: z.array(BRIEF_CATEGORY_SCHEMA).max(40),
  templates: z.record(z.string(), z.string().max(8000)),
});

export async function saveBriefSettings(raw: unknown): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "admin.brief.invalid" };
  const { on, categories } = parsed.data;
  if (new Set(categories.map((c) => c.id)).size !== categories.length) return { ok: false, error: "admin.brief.invalid" };
  // Only the categories' own templates and the general one; an empty one goes back to the default.
  const ids = new Set([...categories.map((c) => c.id), GENERAL]);
  const templates = Object.fromEntries(
    Object.entries(parsed.data.templates)
      .filter(([k, v]) => ids.has(k) && v.trim())
      .map(([k, v]) => [k, cleanBriefText(v, 8000)]),
  );
  const values = { "brief.v3_on": on, "brief.categories": categories, "brief.templates": templates } as const;
  const before = await getSettings(["brief.v3_on", "brief.categories", "brief.templates"]);
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("settings")
    .upsert(
      (Object.keys(values) as (keyof typeof values)[]).map((key) => ({ key, value: values[key], type: SETTINGS[key].type, group: SETTINGS[key].group, description: SETTINGS[key].description, updated_by: admin.id, updated_at: now })),
      { onConflict: "key" },
    );
  settingsChanged();
  if (error) return { ok: false, error: "auth.errors.generic" };
  await audit(admin.id, "update_brief_settings", "settings", "brief", { from: before, to: values });
  refresh();
  return { ok: true };
}
