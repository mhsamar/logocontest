import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/contests/brief";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { LISTS, type ListItem, type ListKey } from "./list-defs";
import { checkList } from "./list-rules";
import { flattenTexts, type TextTree } from "./rules";
import { CONTENT_TAG, getMessages } from "./texts";

const loadRows = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    if (!isSupabaseConfigured()) return {};
    const { data, error } = await createAdminClient().from("site_lists").select("key, items");
    if (error) return {};
    return Object.fromEntries(data.map((r) => [r.key as string, r.items]));
  },
  ["site-lists-v1"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

const rows = cache(loadRows);
const flat = cache(async (locale: Locale) => flattenTexts((await getMessages(locale)) as unknown as TextTree));

/** The built-in items, with today's texts (including any Texts edits). */
export async function builtInList(key: ListKey): Promise<ListItem[]> {
  const [en, bn] = await Promise.all([flat("en"), flat("bn")]);
  return LISTS[key].builtIn.map((b) => {
    const pick = (texts: Record<string, string>) => Object.fromEntries(Object.entries(b.keys ?? {}).map(([field, k]) => [field, texts[k] ?? ""]));
    return { id: b.id, on: true, en: pick(en), bn: pick(bn), href: b.href, column: b.column, value: b.value };
  });
}

/** A list as the admin saved it, or the built-in one. `edited` says which. */
export async function getList(key: ListKey): Promise<{ items: ListItem[]; edited: boolean }> {
  const stored = (await rows())[key];
  if (stored !== undefined) {
    const checked = checkList(key, stored);
    if (checked.ok) return { items: checked.items, edited: true };
  }
  return { items: await builtInList(key), edited: false };
}

/** The visible items of a list, with their texts in one language. */
export async function visibleList(key: ListKey, locale: Locale): Promise<(Omit<ListItem, "en" | "bn"> & { text: Record<string, string> })[]> {
  const { items } = await getList(key);
  return items.filter((i) => i.on).map(({ en, bn, ...rest }) => ({ ...rest, text: locale === "bn" ? bn : en }));
}

/** Business types to offer in filters, in the admin's order; `keep` stays even if hidden (the current filter). */
export async function visibleBusinessTypes(keep?: string | null): Promise<BusinessType[]> {
  const ids = (await visibleList("business_types", "en")).map((b) => b.id).filter((id): id is BusinessType => (BUSINESS_TYPES as readonly string[]).includes(id));
  return keep && !ids.includes(keep as BusinessType) && (BUSINESS_TYPES as readonly string[]).includes(keep) ? [...ids, keep as BusinessType] : ids;
}
