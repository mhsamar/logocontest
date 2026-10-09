"use server";

import { refresh, updateTag } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkText, flattenTexts, isEditableKey, type TextProblem, type TextTree } from "./rules";
import { CONTENT_TAG } from "./texts";

export type TextResult = { ok: true } | { ok: false; error: MessageKey; problems?: Partial<Record<Locale, TextProblem>> };

const builtIn = (locale: Locale) => flattenTexts(MESSAGES[locale] as unknown as TextTree);

/**
 * A-14 Texts: saves the admin's English and Bangla versions of one text. A value equal to the built-in
 * text removes the change, so "Reset" and typing the default back do the same thing.
 */
export async function saveText(key: string, values: Partial<Record<Locale, string>>): Promise<TextResult> {
  const admin = await adminUser("content.manage");
  if (!admin) return { ok: false, error: "auth.errors.generic" };
  const defaults = { en: builtIn("en"), bn: builtIn("bn") };
  if (!isEditableKey(key, defaults.en)) return { ok: false, error: "admin.texts.unknown" };

  const problems: Partial<Record<Locale, TextProblem>> = {};
  const upserts: { key: string; locale: Locale; value: string; updated_by: string }[] = [];
  const resets: Locale[] = [];
  for (const locale of LOCALES) {
    const raw = values[locale];
    if (raw === undefined) continue;
    const value = raw.replace(/\r\n/g, "\n");
    const def = defaults[locale][key] ?? defaults.en[key];
    if (value === def) {
      resets.push(locale);
      continue;
    }
    const problem = checkText(def, value);
    if (problem) problems[locale] = problem;
    else upserts.push({ key, locale, value, updated_by: admin.id });
  }
  if (Object.keys(problems).length) return { ok: false, error: "admin.texts.invalid", problems };

  const db = createAdminClient();
  const { data: before } = await db.from("site_texts").select("locale, value").eq("key", key);
  if (upserts.length) {
    const { error } = await db.from("site_texts").upsert(upserts.map((u) => ({ ...u, updated_at: new Date().toISOString() })));
    if (error) return { ok: false, error: "admin.errors.generic" };
  }
  if (resets.length) {
    const { error } = await db.from("site_texts").delete().eq("key", key).in("locale", resets);
    if (error) return { ok: false, error: "admin.errors.generic" };
  }
  const was = Object.fromEntries((before ?? []).map((r) => [r.locale, r.value]));
  const changed = [...upserts.filter((u) => was[u.locale] !== u.value).map((u) => u.locale), ...resets.filter((l) => l in was)];
  if (changed.length) {
    await audit(admin.id, "update_text", "site_text", key, {
      changes: Object.fromEntries(changed.map((l) => [l, { from: was[l] ?? null, to: upserts.find((u) => u.locale === l)?.value ?? null }])),
    });
  }
  updateTag(CONTENT_TAG);
  refresh();
  return { ok: true };
}

/** A-14 Texts: back to the built-in English and Bangla text. */
export async function resetText(key: string): Promise<TextResult> {
  return saveText(key, { en: builtIn("en")[key], bn: builtIn("bn")[key] });
}
