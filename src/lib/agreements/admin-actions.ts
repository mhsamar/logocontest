"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import { translatorFor } from "@/lib/content/texts";
import { siteOrigin } from "@/lib/email";
import { emailText } from "@/lib/email/events";
import type { MessageKey } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings/registry";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;

/** A-13: an admin opens a designer's full ID number. Every reveal is written to the audit log (§9.6). */
export async function revealIdNumber(designerId: string): Promise<{ ok: true; idNumber: string } | { ok: false }> {
  // Full ID numbers need the Agreements "manage" permission (BLUEPRINT §13.2).
  const user = await adminUser("agreements.manage");
  if (!user || !UUID.test(designerId)) return { ok: false };
  const db = createAdminClient();
  const { data } = await db.from("designer_agreements").select("id_number").eq("designer_id", designerId).maybeSingle();
  if (!data) return { ok: false };
  const { error } = await db.from("audit_logs").insert({ admin_id: user.id, action: "reveal_id_number", subject_type: "designer_agreement", subject_id: designerId });
  if (error) return { ok: false }; // no log, no number
  return { ok: true, idNumber: data.id_number as string };
}

// ---------------------------------------------------------------------------
// The review (owner, 2026-10-12; Design/agreements): Approve, Undo, Reject with a reason, Ask for a photo and the
// admin note. Agreements "manage" only; every action goes to the audit log.
// ---------------------------------------------------------------------------

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });

async function reviewer(designerId: string) {
  const user = await adminUser("agreements.manage");
  if (!user || !UUID.test(designerId)) return null;
  const { data } = await createAdminClient().from("designer_agreements").select("review_status, id_front_path, admin_note").eq("designer_id", designerId).maybeSingle();
  return data ? { user, row: data as { review_status: string; id_front_path: string | null; admin_note: string | null } } : null;
}

async function setReview(designerId: string, values: Record<string, unknown>) {
  return createAdminClient().from("designer_agreements").update(values).eq("designer_id", designerId);
}

/** Approve, or (no photo) approve without one after the confirm step. */
export async function approveAgreement(designerId: string, withoutPhoto = false): Promise<Result> {
  const r = await reviewer(designerId);
  if (!r) return fail("auth.errors.generic");
  if (!r.row.id_front_path && !withoutPhoto) return fail("admin.agreements.review.needsPhoto");
  const { error } = await setReview(designerId, { review_status: "approved", reviewed_by: r.user.id, reviewed_at: new Date().toISOString(), reject_reason: null });
  if (error) return fail("admin.errors.generic");
  await audit(r.user.id, "approve_agreement", "designer_agreement", designerId, { from: r.row.review_status, withoutPhoto });
  refresh();
  return { ok: true };
}

export async function undoAgreementApproval(designerId: string): Promise<Result> {
  const r = await reviewer(designerId);
  if (!r || r.row.review_status !== "approved") return fail("auth.errors.generic");
  const back = r.row.id_front_path ? "needs_review" : "no_photo";
  const { error } = await setReview(designerId, { review_status: back, reviewed_by: null, reviewed_at: null });
  if (error) return fail("admin.errors.generic");
  await audit(r.user.id, "undo_agreement_approval", "designer_agreement", designerId, { to: back });
  refresh();
  return { ok: true };
}

/** In the app and by email, in the designer's language. */
async function tellDesigner(designerId: string, type: "agreement_photo_requested" | "agreement_rejected", params: Record<string, string>) {
  await notify([designerId], type, params, "/dashboard/agreement");
  const { data: p } = await createAdminClient().from("profiles").select("email, name, locale").eq("id", designerId).maybeSingle();
  if (!p?.email) return;
  const lang = p.locale === "bn" ? "bn" : "en";
  const t = await translatorFor(lang);
  const link = `${await siteOrigin()}/dashboard/agreement`;
  const key = type === "agreement_rejected" ? "rejected" : "photo";
  await emailText({ userId: designerId, email: p.email as string, locale: lang, subject: t(`admin.agreements.mail.${key}.subject`), body: t(`admin.agreements.mail.${key}.body`, { name: ((p.name as string | null) ?? "").trim(), reason: params.reason ?? "", link }), security: true });
}

export async function rejectAgreement(designerId: string, reasonText: string): Promise<Result> {
  const r = await reviewer(designerId);
  if (!r) return fail("auth.errors.generic");
  const reason = reasonText.replace(/\s+/g, " ").trim();
  if (reason.length < 5 || reason.length > 300) return fail("admin.agreements.review.reasonLength");
  const { error } = await setReview(designerId, { review_status: "rejected", reviewed_by: r.user.id, reviewed_at: new Date().toISOString(), reject_reason: reason });
  if (error) return fail("admin.errors.generic");
  await audit(r.user.id, "reject_agreement", "designer_agreement", designerId, { from: r.row.review_status, reason });
  await tellDesigner(designerId, "agreement_rejected", { reason });
  refresh();
  return { ok: true };
}

/** "Ask for new photo" / "Ask for an ID photo": the designer uploads one from their agreement page. */
export async function askForIdPhoto(designerId: string): Promise<Result> {
  const r = await reviewer(designerId);
  if (!r) return fail("auth.errors.generic");
  const { error } = await setReview(designerId, { photo_requested_at: new Date().toISOString() });
  if (error) return fail("admin.errors.generic");
  await audit(r.user.id, "ask_id_photo", "designer_agreement", designerId, { status: r.row.review_status });
  await tellDesigner(designerId, "agreement_photo_requested", {});
  refresh();
  return { ok: true };
}

/** The admin note, saved when the box loses focus. */
export async function saveAgreementNote(designerId: string, noteText: string): Promise<Result> {
  const r = await reviewer(designerId);
  if (!r) return fail("auth.errors.generic");
  const note = noteText.replace(/\r\n/g, "\n").trim().slice(0, 1000);
  if (note === (r.row.admin_note ?? "")) return { ok: true };
  const { error } = await setReview(designerId, { admin_note: note || null });
  if (error) return fail("admin.errors.generic");
  await audit(r.user.id, "agreement_note", "designer_agreement", designerId, { from: r.row.admin_note ?? null, to: note || null });
  return { ok: true };
}

/**
 * Admin → Agreements (owner, 2026-10-13): ask designers for the agreement and ID photo before their first design, or
 * not. Agreements already signed stay as they are. Written to the Audit log, old → new.
 */
export async function setAgreementRequired(on: boolean): Promise<Result> {
  const admin = await adminUser("agreements.manage");
  if (!admin || typeof on !== "boolean") return { ok: false, error: "auth.errors.generic" };
  const key = "legal.agreement_required";
  const before = await getSetting(key);
  const def = SETTINGS[key];
  const { error } = await createAdminClient().from("settings").upsert({ key, value: on, type: def.type, group: def.group, description: def.description, updated_by: admin.id });
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, "update_settings", "settings", "legal", { changes: { [key]: { from: before, to: on } } });
  refresh();
  return { ok: true };
}
