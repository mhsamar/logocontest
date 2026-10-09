import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import type { Messages } from "@/lib/i18n/messages/en";
import { createTranslator, type Translate } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyOverrides, type Overrides } from "./rules";

/** Cache tag for everything an admin edits in Site content; saving clears it so the change shows at once. */
export const CONTENT_TAG = "site-content";

type AllOverrides = Record<Locale, Overrides>;
const EMPTY: AllOverrides = { en: {}, bn: {} };

// Shared across requests (the texts change rarely); cleared by updateTag(CONTENT_TAG) on save.
const loadOverrides = unstable_cache(
  async (): Promise<AllOverrides> => {
    if (!isSupabaseConfigured()) return EMPTY;
    const { data, error } = await createAdminClient().from("site_texts").select("key, locale, value");
    // Before migration 0028, or if the database is unreachable, the built-in texts are used.
    if (error) return EMPTY;
    const out: AllOverrides = { en: {}, bn: {} };
    for (const r of data) if (r.locale === "en" || r.locale === "bn") out[r.locale as Locale][r.key as string] = r.value as string;
    return out;
  },
  ["site-texts-v1"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export const textOverrides = cache(loadOverrides);

/** The site's texts in one language: the built-in texts with the admin's changes put in. */
export const getMessages = cache(async (locale: Locale): Promise<Messages> => applyOverrides(MESSAGES[locale], (await textOverrides())[locale]));

/** A translator for a given language outside a page (notifications, emails, push). */
export async function translatorFor(locale: Locale): Promise<Translate> {
  return createTranslator(locale, await getMessages(locale));
}
