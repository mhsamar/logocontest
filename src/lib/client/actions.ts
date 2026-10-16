"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: MessageKey };

/**
 * "Show my profile to designers" (owner, 2026-10-16; CLIENT-HANDOFF §6). Off: the public client profile is private;
 * the client and the admin team still see it. Needs migration 0064.
 */
export async function setProfileShown(shown: boolean): Promise<Result> {
  if (!isSupabaseConfigured() || typeof shown !== "boolean") return { ok: false, error: "auth.errors.generic" };
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status === "banned") return { ok: false, error: "auth.errors.generic" };
  const { error } = await createAdminClient().from("profiles").update({ profile_hidden: !shown }).eq("id", user.id);
  if (error) return { ok: false, error: /profile_hidden/.test(error.message) ? "cw.profile.notReady" : "auth.errors.generic" };
  refresh();
  return { ok: true };
}
