import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSetting, type SettingKey, type SettingValue } from "./registry";

const loadAll = cache(async (): Promise<Map<string, unknown>> => {
  const { data, error } = await createAdminClient().from("settings").select("key, value");
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  return new Map(data.map((row) => [row.key as string, row.value]));
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
