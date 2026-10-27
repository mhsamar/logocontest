import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSetting, type SettingKey, type SettingValue } from "./registry";

/** A dropped connection ("fetch failed") is worth retrying; a database error is not. */
const isNetworkError = (message: string) => /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(message);

/** Cache tag of the settings: every write clears it (settingsChanged), so a change shows at once everywhere. */
export const SETTINGS_TAG = "settings";

// Shared across requests for up to 5 minutes (owner, 2026-10-27: the whole table was downloaded on every request,
// a large part of the database traffic). A failure is never kept, so the next request tries again.
const loadShared = unstable_cache(
  async (): Promise<Record<string, unknown>> => {
    // Before Supabase is connected (local preview), every setting uses its seed default.
    if (!isSupabaseConfigured()) return {};
    // Prices and fees come from here, so we never fall back to defaults: retry a short
    // network blip, and fail loudly if the database really can't be reached.
    let last = "";
    for (const wait of [0, 300, 900]) {
      if (wait) await new Promise((r) => setTimeout(r, wait));
      const { data, error } = await createAdminClient().from("settings").select("key, value");
      if (!error) return Object.fromEntries(data.map((row) => [row.key as string, row.value]));
      last = error.message;
      if (!isNetworkError(last)) break;
    }
    throw new Error(`Could not load settings: ${last}`);
  },
  ["settings-v1"],
  { tags: [SETTINGS_TAG], revalidate: 300 },
);

const loadAll = cache(async (): Promise<Map<string, unknown>> => new Map(Object.entries(await loadShared())));

/**
 * After writing settings: the next read everywhere gets the new values, and in a server action the admin who saved
 * sees them at once. Values changed straight in the database (SQL) show within 5 minutes.
 */
export function settingsChanged(): void {
  try {
    updateTag(SETTINGS_TAG);
  } catch {
    // Not in a server action (a cron job): cleared for the next request.
    revalidateTag(SETTINGS_TAG, "max");
  }
}

/** Typed read of one setting. Loaded once per request. */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const all = await loadAll();
  return parseSetting(key, all.get(key));
}

export async function getSettings<K extends SettingKey>(
  keys: readonly K[],
): Promise<{ [P in K]: SettingValue<P> }> {
  const all = await loadAll();
  return Object.fromEntries(keys.map((k) => [k, parseSetting(k, all.get(k))])) as {
    [P in K]: SettingValue<P>;
  };
}
