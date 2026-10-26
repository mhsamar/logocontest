"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMobile } from "@/lib/phone";
import { adminUser, audit, superAdmin } from "./core";
import { adminIdsWith } from "./recipients";
import { noteResume, resumeLink, resumeTarget } from "@/lib/contests/resume";
import { leadRow, resolve } from "./unpaid-leads";
import { cleanRemindBy } from "./unpaid-alert-rules";
import {
  afterResult,
  dhakaMidnight,
  fakeCloseErrors,
  isHow,
  isNextPreset,
  isResult,
  nextFollowUpAt,
  type FakeClose,
  type How,
  type LeadStatus,
  type NextPreset,
} from "./unpaid-rules";

/**
 * Admin › Unpaid contests, follow-ups (owner, 2026-10-25; Design/unpaid-contests): log a call or message, plan the next
 * follow-up, close a lead (also as fake, with a block on new contests), reopen it (Super admin), and reach the person.
 * Unpaid contests · manage. Every action is in the audit log; reaching someone is logged before their number is given
 * ("no log, no number"). Phone numbers never go into the log.
 */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });
type Row = Record<string, unknown>;
const NOT_READY: MessageKey = "admin.unpaid.fu.errors.notReady";

const cleanNote = (v: unknown, max = 1000) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s ? s.slice(0, max) : null;
};

async function ownerFor(ownerId: unknown, fallback: string): Promise<string | null> {
  if (typeof ownerId !== "string" || !ownerId) return fallback;
  return (await adminIdsWith("unpaid.manage")).includes(ownerId) ? ownerId : null;
}

/** A planned follow-up due by the end of today counts as done when the next one is logged ("Follow-ups today"). */
const completes = (row: Row, now: Date) => {
  const due = row.next_followup_at ? new Date(row.next_followup_at as string) : null;
  return due && due.getTime() < dhakaMidnight(now, 1).getTime() ? due.toISOString() : null;
};

export async function logFollowUp(key: string, input: { how: string; result?: string | null; note?: string; next: string; pickAt?: string | null; ownerId?: string | null; remindBy?: string[] | null }): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!isHow(input.how) || !isNextPreset(input.next)) return fail("admin.errors.generic");
  const how: How = input.how;
  const result = how === "note" ? null : input.result;
  if (how !== "note" && (!isResult(result) || result === "fake")) return fail("admin.unpaid.fu.errors.result");
  const note = cleanNote(input.note);
  if (how === "note" && !note) return fail("admin.unpaid.fu.errors.note");
  const now = new Date();
  const lead = await leadRow(key);
  if (lead === "missing") return fail(NOT_READY);
  if (!lead) return fail("admin.errors.generic");
  const { row } = lead;
  if (row.status === "closed") return fail("admin.unpaid.fu.errors.closed");
  const owner = await ownerFor(input.ownerId, (row.owner_id as string | null) ?? admin.id);
  if (!owner) return fail("admin.errors.generic");
  const after = afterResult({ status: row.status as LeadStatus, streak: Number(row.no_answer_streak ?? 0) }, (result ?? null) as Parameters<typeof afterResult>[1]);
  const keep = input.next === "keep" && !after.close;
  const planned = row.next_followup_at ? new Date(row.next_followup_at as string) : null;
  const next = after.close ? null : keep ? planned : nextFollowUpAt(input.next as NextPreset, now, input.pickAt);
  if (next === "invalid") return fail("admin.unpaid.fu.errors.when");
  // A call or message carries out the follow-up that was due; a note doesn't.
  const done = how === "note" ? null : completes(row, now);
  const db = createAdminClient();
  const contact = how !== "note";
  const { error } = await db
    .from("unpaid_leads")
    .update({
      status: after.status,
      no_answer_streak: after.streak,
      owner_id: owner,
      next_followup_at: next ? next.toISOString() : null,
      next_followup_type: next ? (keep || how === "note" ? ((row.next_followup_type as string | null) ?? "call") : how) : null,
      ...(contact ? { contacts_count: Number(row.contacts_count ?? 0) + 1, last_contact_at: now.toISOString(), last_contact_type: how, last_result: result } : {}),
      ...(after.close ? { closed_reason: after.close, closed_at: now.toISOString(), closed_by: admin.id } : {}),
      updated_at: now.toISOString(),
    })
    .eq("id", row.id as string);
  if (error) return fail("admin.errors.generic");
  await db.from("lead_activities").insert({ lead_id: row.id, admin_id: admin.id, kind: how, result, note, next_followup_at: next ? next.toISOString() : null, completes_at: done, event: after.close ? "closed_not_interested" : null });
  // "Remind me by" (phase 3, owner 2026-10-26): written on its own, so a follow-up still saves before migration 0078.
  const remindBy = cleanRemindBy(input.remindBy);
  if (next && remindBy) await db.from("unpaid_leads").update({ remind_by: remindBy }).eq("id", row.id as string);
  await audit(admin.id, "unpaid_followup", "lead", key, { how, result, next: input.next, owner: owner !== admin.id ? owner : undefined, closed: after.close });
  refresh();
  return { ok: true };
}

/** Change the planned follow-up: when, how and who (the bar's "Change"). */
export async function planFollowUp(key: string, input: { next: string; pickAt?: string | null; type?: string; ownerId?: string | null }): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || !isNextPreset(input.next)) return fail("auth.errors.generic");
  const type = input.type && isHow(input.type) ? input.type : "call";
  const now = new Date();
  if (input.next === "keep") return fail("admin.errors.generic");
  const next = nextFollowUpAt(input.next, now, input.pickAt);
  if (next === "invalid") return fail("admin.unpaid.fu.errors.when");
  const lead = await leadRow(key);
  if (lead === "missing") return fail(NOT_READY);
  if (!lead) return fail("admin.errors.generic");
  if (lead.row.status === "closed") return fail("admin.unpaid.fu.errors.closed");
  const owner = await ownerFor(input.ownerId, (lead.row.owner_id as string | null) ?? admin.id);
  if (!owner) return fail("admin.errors.generic");
  const db = createAdminClient();
  const { error } = await db.from("unpaid_leads").update({ next_followup_at: next ? next.toISOString() : null, next_followup_type: next ? type : null, owner_id: owner, updated_at: now.toISOString() }).eq("id", lead.row.id as string);
  if (error) return fail("admin.errors.generic");
  await db.from("lead_activities").insert({ lead_id: lead.row.id, admin_id: admin.id, kind: "system", event: "planned", next_followup_at: next ? next.toISOString() : null });
  await audit(admin.id, "unpaid_plan", "lead", key, { next: input.next, type, owner: owner !== admin.id ? owner : undefined });
  refresh();
  return { ok: true };
}

/** The planned follow-up was done (the bar's "Done"), without a call to log. */
export async function followUpDone(key: string): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  const lead = await leadRow(key);
  if (lead === "missing") return fail(NOT_READY);
  if (!lead || !lead.row.next_followup_at) return fail("admin.errors.generic");
  const now = new Date();
  const db = createAdminClient();
  const { data, error } = await db.from("unpaid_leads").update({ next_followup_at: null, next_followup_type: null, updated_at: now.toISOString() }).eq("id", lead.row.id as string).eq("next_followup_at", lead.row.next_followup_at as string).select("id");
  if (error || !data?.length) return fail("admin.errors.generic");
  // Counts as today's work only if it was due by the end of today.
  await db.from("lead_activities").insert({ lead_id: lead.row.id, admin_id: admin.id, kind: "system", event: "followup_done", completes_at: completes(lead.row, now) });
  await audit(admin.id, "unpaid_followup_done", "lead", key, {});
  refresh();
  return { ok: true };
}

/** Close a lead: not interested, or paid another way. The note is optional. */
export async function closeLead(key: string, reason: "not_interested" | "paid_other", f: Record<string, string>): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || (reason !== "not_interested" && reason !== "paid_other")) return fail("auth.errors.generic");
  const lead = await leadRow(key);
  if (lead === "missing") return fail(NOT_READY);
  if (!lead) return fail("admin.errors.generic");
  if (lead.row.status === "closed") return fail("admin.unpaid.fu.errors.closed");
  const note = cleanNote(f.note ?? f.reason, 500);
  const now = new Date().toISOString();
  const db = createAdminClient();
  const { error } = await db.from("unpaid_leads").update({ status: "closed", closed_reason: reason, close_note: note, closed_at: now, closed_by: admin.id, next_followup_at: null, next_followup_type: null, updated_at: now }).eq("id", lead.row.id as string);
  if (error) return fail("admin.errors.generic");
  await db.from("lead_activities").insert({ lead_id: lead.row.id, admin_id: admin.id, kind: "system", event: `closed_${reason}`, note });
  await audit(admin.id, "unpaid_close", "lead", key, { reason, note });
  refresh();
  return { ok: true };
}

/**
 * Close as fake (handoff §7): only after the admin ticked that they called and confirmed it, with a reason and a note.
 * Hides the draft from the lists (default), can block the phone and email from new contests, and stops reminders.
 * Nothing is deleted. Only a Super admin can reopen it.
 */
export async function closeAsFake(key: string, input: FakeClose): Promise<Result> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return fail("auth.errors.generic");
  const errors = fakeCloseErrors({ confirmed: input.confirmed === true, reason: input.reason, note: String(input.note ?? "") });
  if (errors.length) return fail(`admin.unpaid.fu.fake.errors.${errors[0]}` as MessageKey);
  const lead = await leadRow(key);
  if (lead === "missing") return fail(NOT_READY);
  if (!lead) return fail("admin.errors.generic");
  if (lead.row.status === "closed") return fail("admin.unpaid.fu.errors.closed");
  const note = cleanNote(input.note, 500)!;
  const now = new Date().toISOString();
  const db = createAdminClient();
  const { error } = await db
    .from("unpaid_leads")
    .update({ status: "closed", closed_reason: "fake", fake_reason: input.reason, close_note: note, closed_at: now, closed_by: admin.id, hidden: input.hide !== false, stop_reminders: input.stopReminders !== false, blocked: input.block === true, next_followup_at: null, next_followup_type: null, updated_at: now })
    .eq("id", lead.row.id as string);
  if (error) return fail("admin.errors.generic");
  let blocked = 0;
  if (input.block === true) {
    // A guest's email was only typed on the first step and may be someone else's: only their number is blocked.
    const values = [...(lead.who.mobile ? [{ kind: "mobile", value: lead.who.mobile }] : []), ...(lead.who.kind === "contest" && lead.who.email ? [{ kind: "email", value: lead.who.email.toLowerCase() }] : [])];
    for (const v of values) {
      const { error: blockError } = await db.from("blocked_contacts").insert({ ...v, lead_id: lead.row.id, reason: note, blocked_by: admin.id });
      if (!blockError) blocked++;
    }
  }
  await db.from("lead_activities").insert({ lead_id: lead.row.id, admin_id: admin.id, kind: "system", event: "closed_fake", note });
  await audit(admin.id, "unpaid_close_fake", "lead", key, { reason: input.reason, note, hide: input.hide !== false, block: blocked > 0 ? blocked : undefined, stopReminders: input.stopReminders !== false });
  refresh();
  return { ok: true };
}

/** Reopen a closed lead (Super admin only): back on the list, and any block it made is lifted. */
export async function reopenLead(key: string, f: Record<string, string>): Promise<Result> {
  const admin = await superAdmin();
  if (!admin) return fail("auth.errors.generic");
  const lead = await leadRow(key);
  if (lead === "missing") return fail(NOT_READY);
  if (!lead || lead.row.status !== "closed") return fail("admin.errors.generic");
  const reason = cleanNote(f.reason, 500);
  const now = new Date().toISOString();
  const db = createAdminClient();
  const { error } = await db
    .from("unpaid_leads")
    .update({ status: Number(lead.row.contacts_count ?? 0) > 0 ? "in_touch" : "new", closed_reason: null, fake_reason: null, close_note: null, closed_at: null, closed_by: null, hidden: false, blocked: false, stop_reminders: false, reopened_at: now, reopened_by: admin.id, updated_at: now })
    .eq("id", lead.row.id as string);
  if (error) return fail("admin.errors.generic");
  // Only this lead's own blocks: another lead closed as fake keeps its own block row for the same phone or email.
  await db.from("blocked_contacts").update({ lifted_at: now, lifted_by: admin.id }).eq("lead_id", lead.row.id as string).is("lifted_at", null);
  await db.from("lead_activities").insert({ lead_id: lead.row.id, admin_id: admin.id, kind: "system", event: "reopened", note: reason });
  await audit(admin.id, "unpaid_reopen", "lead", key, { reason, was: lead.row.closed_reason });
  refresh();
  return { ok: true };
}

/**
 * Find people by the phone or email the admin typed (Unpaid · Manage), so the number never goes into the page's address:
 * the page then shows only these leads by their keys.
 */
export async function findLeadsByContact(text: string): Promise<{ ok: true; keys: string[] } | { ok: false }> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || typeof text !== "string") return { ok: false };
  const raw = text.trim().toLowerCase().slice(0, 120);
  const email = raw.includes("@") ? raw.replace(/[%,()*]/g, "") : null;
  const digits = email ? "" : raw.replace(/\D/g, "").replace(/^0+/, "");
  if (!email && digits.length < 6) return { ok: true, keys: [] };
  const db = createAdminClient();
  const like = email ? `%${email}%` : `%${digits}%`;
  const [people, guests] = await Promise.all([
    db.from("profiles").select("id").ilike(email ? "email" : "mobile", like).eq("role", "client").limit(50),
    db.from("wizard_leads").select("visit_id, mobile, updated_at").ilike(email ? "email" : "mobile", like).order("updated_at", { ascending: false }).limit(50),
  ]);
  const clientIds = (people.data ?? []).map((p) => p.id as string);
  const { data: contests } = clientIds.length ? await db.from("contests").select("id").in("client_id", clientIds).in("status", ["draft", "pending_payment"]).limit(50) : { data: [] as Row[] };
  const seen = new Set<string>();
  const guestKeys = (guests.data ?? []).filter((g) => !seen.has(g.mobile as string) && seen.add(g.mobile as string)).map((g) => `g:${g.visit_id as string}`);
  return { ok: true, keys: [...(contests ?? []).map((c) => `c:${c.id as string}`), ...guestKeys].slice(0, 20) };
}

/**
 * Reach the person (Call, WhatsApp, SMS, Email) or show their number and email. Logged first: no log, no number.
 * Returns where to go (tel:, wa.me, sms:, mailto:) or the contact to show.
 */
export async function reachLead(key: string, channel: "call" | "whatsapp" | "sms" | "email" | "reveal"): Promise<{ ok: true; href?: string; mobile?: string | null; email?: string | null } | { ok: false }> {
  const admin = await adminUser("unpaid.manage");
  if (!admin || !["call", "whatsapp", "sms", "email", "reveal"].includes(channel)) return { ok: false };
  const who = await resolve(key);
  if (!who) return { ok: false };
  const digits = (who.mobile ?? "").replace(/\D/g, "");
  if (channel !== "reveal" && (channel === "email" ? !who.email : !digits)) return { ok: false };
  const { error } = await createAdminClient().from("audit_logs").insert({ admin_id: admin.id, action: channel === "reveal" ? "unpaid_reveal_contact" : "unpaid_contact", subject_type: "lead", subject_id: key, changes: { channel } });
  if (error) return { ok: false };
  if (channel === "reveal") return { ok: true, mobile: who.mobile ? formatMobile(who.mobile) : null, email: who.email };
  const href = channel === "call" ? `tel:+${digits}` : channel === "whatsapp" ? `https://wa.me/${digits}` : channel === "sms" ? `sms:+${digits}` : `mailto:${who.email}`;
  return { ok: true, href };
}

/**
 * The client's resume link (owner, 2026-10-26): opens their unpaid contest at the step where they stopped, without a
 * password. Logged first ("no log, no link"), and noted in the lead's History.
 */
export async function resumeLinkFor(key: string): Promise<{ ok: true; link: string } | { ok: false; error?: MessageKey }> {
  const admin = await adminUser("unpaid.manage");
  if (!admin) return { ok: false };
  const who = await resolve(key);
  if (!who || who.kind !== "contest" || !who.contestId) return { ok: false };
  const target = await resumeTarget(who.contestId);
  // Deleted or paid, the lead closed, or the client's account isn't active: say so.
  if (!target) return { ok: false, error: "admin.unpaid.fu.errors.noResume" };
  const { error } = await createAdminClient().from("audit_logs").insert({ admin_id: admin.id, action: "unpaid_resume_link", subject_type: "lead", subject_id: key, changes: {} });
  if (error) return { ok: false };
  await noteResume(who.contestId, "resume_link", admin.id);
  return { ok: true, link: await resumeLink(who.contestId, new Date(), target.locale) };
}
