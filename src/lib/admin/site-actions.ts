"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { findContactDetails, type ContactKind } from "@/lib/moderation/contact-filter";
import { SETTINGS, type SettingKey } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUser, audit, cleanReason, UUID } from "./core";

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });
const CONTENT_GROUPS = new Set(["contact", "notice"]);

/** A-11 Settings: saves one group. Each value is checked against its schema; changes go to the audit log. */
export async function saveSettings(group: string, values: Record<string, string>, reasonText: string): Promise<Result & { errors?: Record<string, string> }> {
  const admin = await adminUser(CONTENT_GROUPS.has(group) ? "content.manage" : "settings.manage");
  if (!admin) return fail("auth.errors.generic");
  // Brand & notice is site content, not money or rules: no reason needed (still audited).
  const reason = cleanReason(reasonText) ?? (CONTENT_GROUPS.has(group) ? "Brand & notice" : null);
  if (!reason) return fail("admin.errors.reason");
  const keys = (Object.keys(SETTINGS) as SettingKey[]).filter((k) => SETTINGS[k].group === group && k in values);
  if (!keys.length) return fail("auth.errors.generic");

  const db = createAdminClient();
  const { data: current } = await db.from("settings").select("key, value").in("key", keys);
  const before = new Map((current ?? []).map((r) => [r.key as string, r.value]));
  const errors: Record<string, string> = {};
  const changed: { key: SettingKey; value: unknown }[] = [];
  for (const key of keys) {
    const def = SETTINGS[key] as { type: "int" | "bool" | "string" | "json"; schema: import("zod").ZodType; default: unknown };
    const raw = values[key].trim();
    let value: unknown = raw;
    if (def.type === "int") value = raw === "" ? NaN : Number(raw);
    else if (def.type === "json") {
      try {
        value = JSON.parse(raw);
      } catch {
        errors[key] = "json";
        continue;
      }
    } else if (def.type === "bool") value = raw === "true";
    const parsed = def.schema.safeParse(value);
    if (!parsed.success) {
      errors[key] = parsed.error.issues[0]?.message ?? "invalid";
      continue;
    }
    if (JSON.stringify(parsed.data) !== JSON.stringify(before.get(key) ?? def.default)) changed.push({ key, value: parsed.data });
  }
  if (Object.keys(errors).length) return { ok: false, error: "admin.settings.invalid", errors };
  if (!changed.length) return { ok: true };

  const { error } = await db.from("settings").upsert(
    changed.map((c) => ({ key: c.key, value: c.value, type: SETTINGS[c.key].type, group: SETTINGS[c.key].group, description: SETTINGS[c.key].description, updated_by: admin.id })),
  );
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "update_settings", "settings", group, { reason, changes: Object.fromEntries(changed.map((c) => [c.key, { from: before.get(c.key) ?? null, to: c.value }])) });
  refresh();
  return { ok: true };
}

/** A-10 Blocked terms. */
export async function addBlockedTerm(f: Fields): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  const term = (f.term ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (term.length < 2 || term.length > 60) return fail("admin.terms.length");
  const language = ["en", "bn", "any"].includes(f.language ?? "") ? f.language : "any";
  const type = ["phone", "email", "social", "link", "custom"].includes(f.type ?? "") ? f.type : "custom";
  const { error } = await createAdminClient().from("blocked_terms").insert({ term, language, type });
  if (error) return fail(error.code === "23505" ? "admin.terms.exists" : "admin.errors.generic");
  await audit(admin.id, "add_blocked_term", "blocked_term", term, { language, type });
  refresh();
  return { ok: true };
}

export async function removeBlockedTerm(id: number): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !Number.isInteger(id)) return fail("auth.errors.generic");
  const { data, error } = await createAdminClient().from("blocked_terms").delete().eq("id", id).select("term").maybeSingle();
  if (error || !data) return fail("admin.errors.generic");
  await audit(admin.id, "remove_blocked_term", "blocked_term", data.term as string);
  refresh();
  return { ok: true };
}

/** A-10 test box: would this text be blocked by the no-contact filter with the current list? */
export async function testBlockedText(text: string): Promise<{ kind: ContactKind | null }> {
  const admin = await adminUser("content.view");
  if (!admin) return { kind: null };
  const { data } = await createAdminClient().from("blocked_terms").select("term");
  return { kind: findContactDetails(text.slice(0, 2000), (data ?? []).map((r) => r.term as string)) };
}

/** A-09 Homepage: add, remove and reorder featured winning logos. */
export async function featureLogo(entryId: string): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(entryId)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: last } = await db.from("featured_logos").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from("featured_logos").insert({ entry_id: entryId, position: ((last?.position as number | undefined) ?? -1) + 1, created_by: admin.id });
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "feature_logo", "entry", entryId);
  refresh();
  return { ok: true };
}

export async function unfeatureLogo(entryId: string): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(entryId)) return fail("auth.errors.generic");
  const { error } = await createAdminClient().from("featured_logos").delete().eq("entry_id", entryId);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "unfeature_logo", "entry", entryId);
  refresh();
  return { ok: true };
}

export async function moveFeaturedLogo(entryId: string, direction: "up" | "down"): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(entryId)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data } = await db.from("featured_logos").select("entry_id, position").order("position");
  const list = (data ?? []).map((r) => r.entry_id as string);
  const i = list.indexOf(entryId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((id, position) => db.from("featured_logos").update({ position }).eq("entry_id", id)));
  refresh();
  return { ok: true };
}
