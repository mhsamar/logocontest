"use server";

import { refresh, updateTag } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { isListKey } from "./list-defs";
import { checkList, type ListProblem } from "./list-rules";
import { CONTENT_TAG } from "./texts";

export type ListResult = { ok: true } | { ok: false; error: MessageKey; problem?: ListProblem };

/** A-15: saves a whole list (order, visibility, texts) after checking it. */
export async function saveList(key: string, items: unknown): Promise<ListResult> {
  const admin = await adminUser("content.manage");
  if (!admin || !isListKey(key)) return { ok: false, error: "auth.errors.generic" };
  const checked = checkList(key, items);
  if (!checked.ok) return { ok: false, error: `admin.lists.problems.${checked.error.problem}`, problem: checked.error };
  const { error } = await createAdminClient()
    .from("site_lists")
    .upsert({ key, items: checked.items, updated_by: admin.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_list", "site_list", key, { items: checked.items.length });
  updateTag(CONTENT_TAG);
  refresh();
  return { ok: true };
}

/** A-15 "Reset to default": back to the built-in items. */
export async function resetList(key: string): Promise<ListResult> {
  const admin = await adminUser("content.manage");
  if (!admin || !isListKey(key)) return { ok: false, error: "auth.errors.generic" };
  const { error } = await createAdminClient().from("site_lists").delete().eq("key", key);
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "reset_list", "site_list", key);
  updateTag(CONTENT_TAG);
  refresh();
  return { ok: true };
}
