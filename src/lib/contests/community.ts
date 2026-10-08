import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public contest comments and saved contests (BLUEPRINT §10, owner 2026-10-08). */

export type ContestComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { name: string; username: string | null; role: "client" | "designer" | "admin"; isContestClient: boolean };
  mine: boolean;
};

export async function listComments(contestId: string, contestOwnerId: string, viewer: CurrentUser | null): Promise<ContestComment[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("contest_comments")
    .select("id, body, created_at, user_id, author:profiles!user_id(name, username, role)")
    .eq("contest_id", contestId)
    .eq("is_hidden", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const a = (Array.isArray(r.author) ? r.author[0] : r.author) as { name: string; username: string | null; role: ContestComment["author"]["role"] } | null;
    return {
      id: r.id as string,
      body: r.body as string,
      createdAt: new Date(r.created_at as string),
      author: {
        name: a?.name ?? "—",
        username: a?.username ?? null,
        role: a?.role ?? "client",
        isContestClient: r.user_id === contestOwnerId,
      },
      mine: r.user_id === viewer?.id,
    };
  });
}

export async function countComments(contestId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await createAdminClient()
    .from("contest_comments")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contestId)
    .eq("is_hidden", false)
    .is("deleted_at", null);
  return count ?? 0;
}

/** The contest's id, owner and status, for permission checks in actions. */
export async function contestForAction(contestId: string): Promise<{ id: string; slug: string; brand: string; ownerId: string; status: string; isPrivate: boolean; isNda: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(contestId)) return null;
  const { data } = await createAdminClient().from("contests").select("id, slug, brand_name, client_id, status, is_private, is_nda").eq("id", contestId).maybeSingle();
  return data
    ? { id: data.id, slug: data.slug, brand: data.brand_name, ownerId: data.client_id, status: data.status, isPrivate: data.is_private, isNda: Boolean(data.is_nda) }
    : null;
}

export async function insertComment(contestId: string, userId: string, body: string): Promise<void> {
  const { error } = await createAdminClient().from("contest_comments").insert({ contest_id: contestId, user_id: userId, body });
  if (error) throw new Error(error.message);
}

/** Soft-deletes a comment, only if this user wrote it. Returns the contest's slug. */
export async function deleteOwnComment(commentId: string, userId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) return null;
  const { data } = await createAdminClient()
    .from("contest_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("contest:contests!contest_id(slug)")
    .maybeSingle();
  const c = data && ((Array.isArray(data.contest) ? data.contest[0] : data.contest) as { slug: string } | null);
  return c?.slug ?? null;
}

export async function blockedTerms(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("blocked_terms").select("term").limit(1000);
  return (data ?? []).map((r) => r.term as string);
}

// ---------------------------------------------------------------------------
// Saved contests
// ---------------------------------------------------------------------------

/** Which of these contests the user saved. */
export async function savedContestIds(userId: string | undefined, contestIds: string[]): Promise<Set<string>> {
  if (!userId || contestIds.length === 0 || !isSupabaseConfigured()) return new Set();
  const { data } = await createAdminClient().from("contest_favorites").select("contest_id").eq("user_id", userId).in("contest_id", contestIds);
  return new Set((data ?? []).map((r) => r.contest_id as string));
}

export async function setSaved(userId: string, contestId: string, saved: boolean): Promise<void> {
  const db = createAdminClient().from("contest_favorites");
  const { error } = saved
    ? await db.upsert({ user_id: userId, contest_id: contestId }, { onConflict: "user_id,contest_id", ignoreDuplicates: true })
    : await db.delete().eq("user_id", userId).eq("contest_id", contestId);
  if (error) throw new Error(error.message);
}

/** Contest ids the user saved, newest saved first. */
export async function savedContestIdList(userId: string, limit: number): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("contest_favorites")
    .select("contest_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.contest_id as string);
}

export async function countSaved(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await createAdminClient().from("contest_favorites").select("contest_id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}
