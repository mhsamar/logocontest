"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_STATUSES } from "./public-statuses";

/** A designer accepts an NDA contest's confidentiality agreement (BLUEPRINT §7.4, owner 2026-10-08). */
export async function acceptNda(contestId: string): Promise<{ ok: true } | { ok: false; error: MessageKey }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return { ok: false, error: "contest.nda.designersOnly" };
  if (!/^[0-9a-f-]{36}$/i.test(contestId)) return { ok: false, error: "auth.errors.generic" };
  const db = createAdminClient();
  const { data } = await db.from("contests").select("id, status, is_nda").eq("id", contestId).maybeSingle();
  if (!data || !data.is_nda || !(PUBLIC_STATUSES as readonly string[]).includes(data.status)) return { ok: false, error: "auth.errors.generic" };
  const { error } = await db.from("nda_acceptances").upsert({ contest_id: data.id, user_id: user.id }, { onConflict: "contest_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "auth.errors.generic" };
  refresh();
  return { ok: true };
}
