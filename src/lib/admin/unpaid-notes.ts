import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Call notes on unpaid contests (owner, 2026-10-20; migration 0068): what the client said when the team called or
 * messaged, so the next person knows (posted by mistake, will pay later, wants to start again…).
 */

export const UNPAID_OUTCOMES = ["mistake", "later", "restart", "help", "price", "no_answer", "not_interested", "other"] as const;
export type UnpaidOutcome = (typeof UNPAID_OUTCOMES)[number];
export const isUnpaidOutcome = (v: string): v is UnpaidOutcome => (UNPAID_OUTCOMES as readonly string[]).includes(v);

export type UnpaidNote = { id: string; outcome: UnpaidOutcome; note: string | null; by: string | null; at: Date };

/** The notes per contest, newest first; null before migration 0068 has run. */
export async function unpaidNotes(contestIds: string[]): Promise<Map<string, UnpaidNote[]> | null> {
  const out = new Map<string, UnpaidNote[]>();
  if (contestIds.length === 0) return out;
  const { data, error } = await createAdminClient()
    .from("unpaid_notes")
    .select("id, contest_id, outcome, note, created_at, admin:profiles!admin_id(name)")
    .in("contest_id", contestIds)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return /does not exist|schema cache|Could not find/i.test(error.message) ? null : out;
  for (const r of data ?? []) {
    const admin = (Array.isArray(r.admin) ? r.admin[0] : r.admin) as { name: string } | null;
    const list = out.get(r.contest_id as string) ?? [];
    list.push({ id: r.id as string, outcome: r.outcome as UnpaidOutcome, note: (r.note as string | null) ?? null, by: admin?.name ?? null, at: new Date(r.created_at as string) });
    out.set(r.contest_id as string, list);
  }
  return out;
}
