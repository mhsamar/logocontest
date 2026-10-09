"use server";

import { refresh, updateTag } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import { CONTENT_TAG } from "@/lib/content/texts";
import { isLocale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGAL_PLACEHOLDERS } from "./placeholders";
import { textToAgreement, textToDoc, usedPlaceholders } from "./format";
import { isLegalDocSlug } from "./store";

export type LegalResult = { ok: true; version: string } | { ok: false; error: MessageKey; names?: string };

const dhakaDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

/** A-16 Publish: checks the text, stores it with today's date as "Last updated". */
export async function publishLegal(slug: string, locale: string, body: string, resign: boolean): Promise<LegalResult> {
  const admin = await adminUser("content.manage");
  if (!admin || !isLegalDocSlug(slug) || !isLocale(locale)) return { ok: false, error: "auth.errors.generic" };
  const text = body.replace(/\r\n/g, "\n");
  const parsed = slug === "agreement" ? textToAgreement(text) : textToDoc(text);
  if (!parsed.ok) return { ok: false, error: `admin.legal.problems.${parsed.problem}` };
  const unknown = usedPlaceholders(text).filter((n) => !LEGAL_PLACEHOLDERS.includes(n));
  if (unknown.length) return { ok: false, error: "admin.legal.problems.placeholder", names: unknown.map((n) => `{${n}}`).join(" ") };

  const version = dhakaDate();
  const db = createAdminClient();
  const askAgain = slug === "agreement" && resign;
  const { error } = await db.from("legal_docs").upsert({ slug, locale, body: text, version, require_resign: askAgain, published_by: admin.id, published_at: new Date().toISOString() });
  if (error) return { ok: false, error: "admin.errors.generic" };
  if (askAgain) {
    const key = "legal.agreement_resign_since" as const;
    const def = SETTINGS[key];
    await db.from("settings").upsert({ key, value: new Date().toISOString(), type: def.type, group: def.group, description: def.description, updated_by: admin.id });
  }
  await audit(admin.id, "publish_legal", "legal_doc", `${slug}:${locale}`, { version, resign: askAgain, length: text.length });
  updateTag(CONTENT_TAG);
  refresh();
  return { ok: true, version };
}

/** A-16 "Reset to default": back to the built-in text for this page and language. */
export async function resetLegal(slug: string, locale: string): Promise<LegalResult> {
  const admin = await adminUser("content.manage");
  if (!admin || !isLegalDocSlug(slug) || !isLocale(locale)) return { ok: false, error: "auth.errors.generic" };
  const { error } = await createAdminClient().from("legal_docs").delete().eq("slug", slug).eq("locale", locale);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "reset_legal", "legal_doc", `${slug}:${locale}`);
  updateTag(CONTENT_TAG);
  refresh();
  return { ok: true, version: "" };
}
