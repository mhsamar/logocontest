import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/** A test account (Admin › Users): its pages and contests stay out of search engines (owner, 2026-10-21). */
export const isTestAccount = cache(async (id: string | null | undefined): Promise<boolean> => {
  if (!id) return false;
  const { data } = await createAdminClient().from("profiles").select("is_test").eq("id", id).maybeSingle();
  return Boolean(data?.is_test);
});
