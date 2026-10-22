import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/** A test account (Admin › Users): its pages and contests stay out of search engines (owner, 2026-10-21). */
export const isTestAccount = cache(async (id: string | null | undefined): Promise<boolean> => {
  if (!id) return false;
  const { data } = await createAdminClient().from("profiles").select("is_test").eq("id", id).maybeSingle();
  return Boolean(data?.is_test);
});

/** Which of these people are test accounts (one query). */
export async function testIdsAmong(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Set();
  const { data } = await createAdminClient().from("profiles").select("id").in("id", unique).eq("is_test", true);
  return new Set((data ?? []).map((r) => r.id as string));
}

/**
 * Which of these contests belong to a test client (owner, 2026-10-22): a test contest works end to end for test
 * accounts (by direct link) but is never announced to real designers, listed publicly or posted anywhere.
 */
export async function testContestIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await createAdminClient().from("contests").select("id, owner:profiles!client_id!inner(is_test)").in("id", ids).eq("owner.is_test", true);
  return new Set((data ?? []).map((r) => r.id as string));
}

export const isTestContest = cache(async (id: string) => (await testContestIds([id])).has(id));
