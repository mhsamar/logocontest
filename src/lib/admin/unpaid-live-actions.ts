"use server";

import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanHelpText, HELP_MAX_MESSAGES, OFFER_BODY_MAX, offerBlock } from "@/lib/wizard-live-rules";
import { adminUser, audit, UUID } from "./core";

/**
 * Admin › Unpaid contests, "Creating a contest right now" (owner, 2026-10-25; Design/unpaid-contests, phase 2): send
 * the one help message a visit may get (only on Start a contest, never at payment) and answer them once they reply.
 * Both need Unpaid · Manage and go into the audit log, never with the message text. (Watch is logged where its answers
 * are read: the live route.)
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });
const NOT_READY: MessageKey = "admin.unpaid.fu.now.errors.notReady";
const visitOf = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);

export async function offerHelp(visitId: string, body: string): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  const visit = visitOf(visitId);
  if (!visit) return fail("admin.errors.generic");
  const text = cleanHelpText(body, OFFER_BODY_MAX);
  if (!text) return fail("admin.unpaid.fu.now.errors.empty");
  const db = createAdminClient();
  const [{ data: row, error }, { data: sent, error: offerError }] = await Promise.all([
    db.from("wizard_live").select("stage, user_id, contest_id, away, updated_at, ended_at").eq("visit_id", visit).maybeSingle(),
    db.from("help_offers").select("id").eq("visit_id", visit).maybeSingle(),
  ]);
  if (error || offerError) return fail(NOT_READY);
  // Only to someone on Start a contest right now, before payment, and once per visit.
  const block = offerBlock(row ? { stage: Number(row.stage), updatedAt: new Date(row.updated_at as string), endedAt: row.ended_at ? new Date(row.ended_at as string) : null, away: row.away === true } : null, new Date(), Boolean(sent));
  if (block || !row) return fail(`admin.unpaid.fu.now.errors.${block ?? "gone"}`);
  // The visit is unique, so two admins pressing Send at the same moment make one message.
  const { data: made, error: insertError } = await db.from("help_offers").insert({ visit_id: visit, user_id: row.user_id, contest_id: row.contest_id, admin_id: admin.id, stage_at_send: row.stage }).select("id").maybeSingle();
  if (!made) return fail(insertError?.code === "23505" ? "admin.unpaid.fu.now.errors.already" : "admin.errors.generic");
  const { error: messageError } = await db.from("help_messages").insert({ offer_id: made.id, from_admin: true, admin_id: admin.id, kind: "text", body: text });
  if (messageError) {
    await db.from("help_offers").delete().eq("id", made.id);
    return fail("admin.errors.generic");
  }
  await audit(admin.id, "unpaid_offer_help", "visit", visit, { stage: row.stage });
  return { ok: true };
}

/** An answer in the chat, once the person has replied (the first message stays the only one they didn't ask for). */
export async function helpReply(visitId: string, body: string): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  const visit = visitOf(visitId);
  if (!visit) return fail("admin.errors.generic");
  const text = cleanHelpText(body, OFFER_BODY_MAX);
  if (!text) return fail("admin.unpaid.fu.now.errors.empty");
  const db = createAdminClient();
  const { data: offer, error } = await db.from("help_offers").select("id, status, answered_at").eq("visit_id", visit).maybeSingle();
  if (error) return fail(NOT_READY);
  if (!offer) return fail("admin.errors.generic");
  if (offer.status === "declined") return fail("admin.unpaid.fu.now.errors.declined");
  if (!offer.answered_at) return fail("admin.unpaid.fu.now.errors.waiting");
  const { count } = await db.from("help_messages").select("id", { count: "exact", head: true }).eq("offer_id", offer.id).eq("from_admin", true);
  if ((count ?? 0) >= HELP_MAX_MESSAGES) return fail("admin.unpaid.fu.now.errors.tooMany");
  const now = new Date().toISOString();
  const { error: insertError } = await db.from("help_messages").insert({ offer_id: offer.id, from_admin: true, admin_id: admin.id, kind: "text", body: text });
  if (insertError) return fail("admin.errors.generic");
  await db.from("help_offers").update({ last_message_at: now, admin_seen_at: now }).eq("id", offer.id);
  await audit(admin.id, "unpaid_help_reply", "visit", visit);
  return { ok: true };
}
