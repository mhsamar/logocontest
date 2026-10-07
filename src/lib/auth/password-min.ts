import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";

/** Min password length for form hints; falls back to the seed default before the DB is connected. */
export async function passwordMinLength(): Promise<number> {
  if (!isSupabaseConfigured()) return SETTINGS["auth.password_min_length"].default;
  return getSetting("auth.password_min_length");
}
