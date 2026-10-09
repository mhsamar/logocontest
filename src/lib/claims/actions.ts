"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOpenClaim, CLAIM_NOTE_MAX, CLAIM_NOTE_MIN, cleanEvidenceUrls, isClaimDecision } from "./rules";

type Fail = { ok: false; error: { key: MessageKey; params?: MessageParams } };
const fail = (key: MessageKey, params?: MessageParams): Fail => ({ ok: false, error: { key, params } });
const UUID = /^[0-9a-f-]{36}$/i;

async function adminIds(): Promise<string[]> {
  const { data } = await createAdminClient().from("profiles").select("id").eq("role", "admin").eq("status", "active");
  return (data ?? []).map((r) => r.id as string);
}

/** C-17: the client reports the winning design as copied, within the claim days (BLUEPRINT §7.6). */
export async function openCopyClaim(input: { handoverId: string; note: string; links: string[] }): Promise<{ ok: true } | Fail> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active" || !UUID.test(input.handoverId)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: h } = await db
    .from("handovers")
    .select("id, contest_id, entry_id, designer_id, status, created_at, contest:contests!contest_id(slug, brand_name, client_id)")
    .eq("id", input.handoverId)
    .maybeSingle();
  const contest = (Array.isArray(h?.contest) ? h.contest[0] : h?.contest) as { slug: string; brand_name: string; client_id: string } | null | undefined;
  if (!h || contest?.client_id !== user.id) return fail("auth.errors.generic");

  const note = input.note.replace(/\r\n/g, "\n").trim();
  if (note.length < CLAIM_NOTE_MIN || note.length > CLAIM_NOTE_MAX) return fail("claims.errors.note", { min: CLAIM_NOTE_MIN, max: CLAIM_NOTE_MAX });
  const links = cleanEvidenceUrls(input.links);
  if (!links) return fail("claims.errors.links");

  const { "timers.copy_claim_days": days } = await getSettings(["timers.copy_claim_days"]);
  const { count } = await db.from("copy_claims").select("id", { count: "exact", head: true }).eq("handover_id", h.id).eq("status", "open");
  if (!canOpenClaim({ status: h.status as string, pickedAt: new Date(h.created_at as string) }, new Date(), days, (count ?? 0) > 0)) return fail("claims.errors.closed");

  const { error } = await db.from("copy_claims").insert({
    contest_id: h.contest_id,
    handover_id: h.id,
    entry_id: h.entry_id,
    client_id: user.id,
    designer_id: h.designer_id,
    note,
    evidence_urls: links,
  });
  if (error) return fail(error.code === "23505" ? "claims.errors.closed" : "claims.errors.generic");

  await Promise.all([
    notify([h.designer_id as string], "claim_opened", { brand: contest.brand_name }, `/dashboard/handover/${contest.slug}`, user.id),
    notify(await adminIds(), "claim_opened_admin", { brand: contest.brand_name }, "/admin/claims", user.id),
  ]);
  refresh();
  return { ok: true };
}

/** A-13: an admin rejects a claim or upholds it with a correction, a fine or a ban (BLUEPRINT §7.6). */
export async function resolveCopyClaim(input: { claimId: string; decision: string; fine: number; note: string }): Promise<{ ok: true } | Fail> {
  const user = await getCurrentUser();
  if (!can(user, "admin.access") || !user || !UUID.test(input.claimId) || !isClaimDecision(input.decision)) return fail("auth.errors.generic");
  const note = input.note.replace(/\r\n/g, "\n").trim();
  if (note.length < 5 || note.length > 1000) return fail("claims.errors.adminNote");
  const fine = Math.floor(Number(input.fine) || 0);
  if (input.decision === "fine" && fine <= 0) return fail("claims.errors.fine");

  const s = await getSettings(["timers.designer_file_upload_days", "timers.repick_window_days"]);
  const db = createAdminClient();
  const { data, error } = await db.rpc("resolve_copy_claim", {
    p_claim_id: input.claimId,
    p_admin_id: user.id,
    p_decision: input.decision,
    p_fine: fine,
    p_note: note,
    p_upload_days: s["timers.designer_file_upload_days"],
    p_repick_days: s["timers.repick_window_days"],
  });
  if (error || !data) return fail("claims.errors.generic");
  const claim = data as { id: string; contest_id: string; client_id: string; designer_id: string; outcome: string | null; fine_amount: number | null };

  await db.from("audit_logs").insert({
    admin_id: user.id,
    action: "resolve_copy_claim",
    subject_type: "copy_claim",
    subject_id: claim.id,
    changes: { decision: input.decision, fine: claim.fine_amount, note },
  });

  const { data: c } = await db.from("contests").select("slug, brand_name").eq("id", claim.contest_id).maybeSingle();
  const brand = (c?.brand_name as string) ?? "";
  const manage = `/dashboard/contests/${c?.slug ?? ""}`;
  const handover = `/dashboard/handover/${c?.slug ?? ""}`;
  if (input.decision === "rejected") {
    await notify([claim.client_id], "claim_rejected_client", { brand }, manage, user.id);
    await notify([claim.designer_id], "claim_rejected_designer", { brand }, handover, user.id);
  } else if (input.decision === "correction") {
    await notify([claim.client_id], "claim_correction_client", { brand }, manage, user.id);
    await notify([claim.designer_id], "claim_correction_designer", { brand }, handover, user.id);
  } else {
    const days = s["timers.repick_window_days"];
    await notify([claim.client_id], "claim_upheld_client", { brand, days }, manage, user.id);
    await notify([claim.designer_id], input.decision === "fine" ? "claim_fined" : "claim_banned", { brand, amount: claim.fine_amount ?? undefined }, "/dashboard", user.id);
  }
  refresh();
  return { ok: true };
}
