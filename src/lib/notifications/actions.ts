"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markAllRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isSupabaseConfigured()) return;
  await createAdminClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  refresh();
}

export async function markRead(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await createAdminClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).is("read_at", null);
}
