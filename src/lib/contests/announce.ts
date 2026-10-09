import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { broadcastToDesigners } from "@/lib/notifications/broadcast";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "New logo contest: submit your logo and win" to every designer, once per contest (owner, 2026-10-09).
 * Called when a payment opens a contest, and by the lifecycle job for any it finds unannounced.
 */
export async function announceContest(contestId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("id, slug, brand_name, prize_amount, status, is_private, is_nda").eq("id", contestId).maybeSingle();
  if (!c || c.status !== "open") return false;
  // Recorded first, so two callers never announce twice.
  const { error } = await db.from("lifecycle_events").insert({ contest_id: c.id, kind: "announced" });
  if (error) return false;
  // Private and NDA contests still want designers; their names stay hidden from people who can't see the brief.
  const brand = c.is_private || c.is_nda ? null : (c.brand_name as string);
  await broadcastToDesigners(brand ? "contest_new" : "contest_new_private", { brand: brand ?? undefined, amount: c.prize_amount as number }, `/contest/${c.slug}`);
  return true;
}

/** The contest a payment opened, if it is one. */
export async function announceForPayment(paymentId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { data } = await createAdminClient().from("payments").select("contest_id, purpose, status").eq("id", paymentId).maybeSingle();
  if (data && data.purpose === "contest" && data.status === "paid") await announceContest(data.contest_id as string);
}
