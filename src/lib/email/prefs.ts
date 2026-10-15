import "server-only";
import { isSupabaseConfigured, requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOptionalKey, parseEmailOff, type OptionalKey } from "./catalog";
import { unsubscribeOk } from "./links";

/** The emails this person turned off (Email settings, owner 2026-10-15). Empty before migration 0057. */
export async function getEmailOff(userId: string): Promise<OptionalKey[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient().from("profiles").select("email_off").eq("id", userId).maybeSingle();
  return error ? [] : parseEmailOff(data?.email_off);
}

export async function setEmailOff(userId: string, off: readonly string[]): Promise<boolean> {
  const { error } = await createAdminClient().from("profiles").update({ email_off: parseEmailOff(off) }).eq("id", userId);
  if (error) console.error("[email] settings:", error.message);
  return !error;
}

/** Turns one email on or off. */
export async function setOneEmail(userId: string, key: OptionalKey, on: boolean): Promise<boolean> {
  const off = await getEmailOff(userId);
  return setEmailOff(userId, on ? off.filter((k) => k !== key) : [...off, key]);
}

/** The person and email an Unsubscribe link is for, when its signature is right. */
export function readUnsubscribe(u: unknown, k: unknown, s: unknown): { userId: string; key: OptionalKey } | null {
  if (typeof u !== "string" || !/^[0-9a-f-]{36}$/i.test(u) || !isOptionalKey(k) || typeof s !== "string") return null;
  return unsubscribeOk(requireEnv("OTP_SECRET"), u, k, s) ? { userId: u, key: k } : null;
}
