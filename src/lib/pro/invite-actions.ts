"use server";

import { currentUsernameFor } from "@/lib/profile/usernames";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyInvited } from "./invites";
import { invitesLeft } from "./rules";
import { getProSettings } from "./settings";
import { isPro, proIdsAmong } from "./status";

type Result = { ok: true; sent: number } | { ok: false; error: MessageKey; params?: MessageParams };

const UUID = /^[0-9a-f-]{36}$/i;
const EDITABLE = ["draft", "pending_payment", "open"];

/**
 * Contest creation, step "Invite Pro designers" (owner, 2026-10-13): the client's picks for this contest. Free, Pro
 * designers only, at most invites_per_contest (Admin › Pro plan) in total; already-sent invitations stay. When the
 * contest is already open the designers hear at once; otherwise when it opens.
 */
export async function saveContestInvites(contestId: string, designerIds: string[]): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || !UUID.test(contestId)) return { ok: false, error: "auth.errors.generic" };
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.features.invitations) return { ok: false, error: "pro.invite.errors.off" };
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("id, client_id, status").eq("id", contestId).maybeSingle();
  if (!c || c.client_id !== user.id || !EDITABLE.includes(c.status as string)) return { ok: false, error: "auth.errors.generic" };

  const picked = [...new Set((Array.isArray(designerIds) ? designerIds : []).filter((x) => typeof x === "string" && UUID.test(x)))];
  const { data: existing } = await db.from("contest_invites").select("designer_id, notified_at, status").eq("contest_id", contestId);
  // Declined and removed invitations don't use up the number (owner, 2026-10-14).
  const sent = (existing ?? []).filter((r) => r.notified_at && (r.status === "pending" || r.status === "accepted")).map((r) => r.designer_id as string);
  const wanted = [...new Set([...sent, ...picked])];
  if (invitesLeft(sent.length, settings) < wanted.length - sent.length) return { ok: false, error: "pro.invite.errors.tooMany", params: { max: settings.invitesPerContest } };
  const pro = await proIdsAmong(picked);
  if (picked.some((id) => !pro.has(id))) return { ok: false, error: "pro.invite.errors.notPro" };

  // Picks not yet sent can still change; sent invitations stay.
  const unsent = (existing ?? []).filter((r) => !r.notified_at && !picked.includes(r.designer_id as string)).map((r) => r.designer_id as string);
  if (unsent.length) await db.from("contest_invites").delete().eq("contest_id", contestId).in("designer_id", unsent).is("notified_at", null);
  const fresh = picked.filter((id) => !(existing ?? []).some((r) => r.designer_id === id));
  if (fresh.length) {
    const { error } = await db.from("contest_invites").insert(fresh.map((designer_id) => ({ contest_id: contestId, designer_id, invited_by: user.id })));
    if (error) return { ok: false, error: "auth.errors.generic" };
  }
  if (c.status === "open") await notifyInvited(contestId);
  refresh();
  return { ok: true, sent: picked.length };
}

export type FoundDesigner = { id: string; name: string; username: string };

/**
 * "Invite by Designer ID" (owner, 2026-10-14): the client types a designer's ID (their username, with or without @).
 * The server checks the ID exists, belongs to a designer, and that their Pro (plan or free trial) is active.
 */
export async function findProDesigner(raw: string): Promise<{ ok: true; designer: FoundDesigner } | { ok: false; error: MessageKey }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return { ok: false, error: "auth.errors.generic" };
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.features.invitations) return { ok: false, error: "pro.invite.errors.off" };
  const typed = String(raw ?? "").trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(typed)) return { ok: false, error: "pro.invite.errors.idNotFound" };
  // A Pro designer may have changed their username (owner, 2026-10-15): an old ID still finds them.
  const name = (await currentUsernameFor(typed)) ?? typed;
  const { data } = await createAdminClient().from("profiles").select("id, name, username, role, status").eq("username", name).maybeSingle();
  if (!data || data.role !== "designer" || data.status !== "active") return { ok: false, error: "pro.invite.errors.idNotFound" };
  if (!(await isPro(data.id as string))) return { ok: false, error: "pro.invite.errors.idNotPro" };
  return { ok: true, designer: { id: data.id as string, name: data.name as string, username: data.username as string } };
}

/**
 * The invited designer accepts or declines (owner, 2026-10-14). Only to take part in the contest: no hiring, and no
 * chat until they send a design. They can change their mind while the contest is open.
 */
export async function respondToInvite(contestId: string, decision: "accepted" | "declined"): Promise<{ ok: true } | { ok: false; error: MessageKey }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || !UUID.test(contestId) || (decision !== "accepted" && decision !== "declined")) return { ok: false, error: "auth.errors.generic" };
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("status").eq("id", contestId).maybeSingle();
  if (!c || c.status !== "open") return { ok: false, error: "pro.invite.errors.closed" };
  const { data, error } = await db
    .from("contest_invites")
    .update({ status: decision, responded_at: new Date().toISOString() })
    .eq("contest_id", contestId)
    .eq("designer_id", user.id)
    .in("status", ["pending", "accepted", "declined"])
    .not("notified_at", "is", null)
    .select("contest_id");
  if (error || !data?.length) return { ok: false, error: "auth.errors.generic" };
  refresh();
  return { ok: true };
}
