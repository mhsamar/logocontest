"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { createAdminClient } from "@/lib/supabase/admin";
import { contestPayV3, type PayV3 } from "./pay-v3";

/**
 * The contest payment screens (owner, 2026-11-06; Design/logocontest-update): their data, where the payment stands
 * (the waiting screen asks every 20 seconds), "pay later" and the count of clients who reach the screen. Only the
 * payer's own contest payment.
 */

async function own(paymentId: string) {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(paymentId)) return null;
  const user = await getCurrentUser();
  if (!user || user.status === "banned") return null;
  const data = await contestPayV3(paymentId, user.id);
  return data ? { user, data } : null;
}

/** The screens' data, for the wizard's payment step. */
export async function loadPayV3(paymentId: string): Promise<PayV3 | null> {
  return (await own(paymentId))?.data ?? null;
}

/** Where the payment stands now: open, sent and waiting, approved (the contest is live), or closed. */
export async function payV3State(paymentId: string): Promise<{ state: PayV3["state"]; slug: string | null; rejected: string | null }> {
  const o = await own(paymentId);
  return o ? { state: o.data.state, slug: o.data.slug, rejected: o.data.rejected } : { state: "closed", slug: null, rejected: null };
}

/** Counts a client reaching the payment screen (once per contest), for Admin › Payments. */
export async function payV3Opened(paymentId: string): Promise<void> {
  const o = await own(paymentId);
  if (!o) return;
  await createAdminClient().from("pay_events").upsert({ contest_id: o.data.contestId, user_id: o.user.id, event: "opened" }, { onConflict: "contest_id,event", ignoreDuplicates: true });
}

/**
 * "Not now, I'll pay later": the contest stays saved (unpaid, as it already is) and the client gets the link to pay by
 * bell and push; the unpaid reminders (Admin › Unpaid) email them as before. Counted once per contest.
 */
export async function payV3Later(paymentId: string): Promise<{ ok: boolean }> {
  const o = await own(paymentId);
  if (!o || o.data.state !== "open") return { ok: false };
  const { error } = await createAdminClient().from("pay_events").insert({ contest_id: o.data.contestId, user_id: o.user.id, event: "later" });
  // The first "later" only: tapping it again sends nothing more.
  if (!error) await notifyWithPush([o.user.id], "payment_later", { brand: o.data.brand, amount: o.data.amount }, `/pay/contest/${paymentId}`);
  return { ok: true };
}
