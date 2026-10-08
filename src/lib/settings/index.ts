import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSetting, type SettingKey, type SettingValue } from "./registry";

/** A dropped connection ("fetch failed") is worth retrying; a database error is not. */
const isNetworkError = (message: string) => /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket/i.test(message);

const loadAll = cache(async (): Promise<Map<string, unknown>> => {
  // Before Supabase is connected (local preview), every setting uses its seed default.
  if (!isSupabaseConfigured()) return new Map();
  // Prices and fees come from here, so we never fall back to defaults: retry a short
  // network blip, and fail loudly if the database really can't be reached.
  let last = "";
  for (const wait of [0, 300, 900]) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    const { data, error } = await createAdminClient().from("settings").select("key, value");
    if (!error) return new Map(data.map((row) => [row.key as string, row.value]));
    last = error.message;
    if (!isNetworkError(last)) break;
  }
  throw new Error(`Could not load settings: ${last}`);
});

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
