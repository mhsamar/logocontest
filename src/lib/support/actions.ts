"use server";

import { refresh } from "next/cache";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { adminIdsWith } from "@/lib/admin/recipients";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n/translate";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { formatMobile, normalizeBdMobile } from "@/lib/phone";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { translatorFor } from "@/lib/content/texts";
import { isThreadMode, type ThreadMode } from "./ai-rules";
import { answerWithAi, assistantOn, handOver, type ChatUser } from "./assistant";
import { myConversation, threadDetail, type SupportMessage, type SupportThread } from "./queries";
import { cleanMessage, isAudience, preview } from "./rules";

type Fail = { ok: false; error: MessageKey };
const fail = (error: MessageKey): Fail => ({ ok: false, error });

/** Signed-in clients and designers (not banned) may use support chat. */
async function chatUser() {
  const user = await getCurrentUser();
  return user && (user.role === "client" || user.role === "designer") && user.status !== "banned" ? user : null;
}

// ---- S-01 the user's side ------------------------------------------------------------------------

/** The chat's mode and who has it (before migration 0058: every chat is with the team). */
async function threadState(userId: string): Promise<{ unread: number; mode: ThreadMode; assignedTo: string | null } | null> {
  const db = createAdminClient();
  let { data, error } = await db.from("support_threads").select("unread_by_admin, mode, assigned_to").eq("user_id", userId).maybeSingle();
  if (error) ({ data, error } = await db.from("support_threads").select("unread_by_admin").eq("user_id", userId).maybeSingle());
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return { unread: (row.unread_by_admin as number) ?? 0, mode: isThreadMode(row.mode) ? row.mode : "human", assignedTo: (row.assigned_to as string | null) ?? null };
}

const asChatUser = (user: NonNullable<Awaited<ReturnType<typeof chatUser>>>): ChatUser => ({
  id: user.id,
  name: user.name,
  role: user.role as "client" | "designer",
  locale: user.locale === "bn" ? "bn" : "en",
  emailVerifiedAt: user.emailVerifiedAt,
});

/**
 * Sends a message to support. While the AI assistant has the chat (owner, 2026-10-15) it answers at once, or hands the
 * chat to the team. Otherwise staff get a bell + push for the first unread message: the assigned staff member only,
 * or everyone who handles support when nobody has it yet.
 */
export async function sendSupportMessage(body: string): Promise<{ ok: true } | Fail> {
  const user = await chatUser();
  if (!user) return fail("support.errors.signIn");
  const text = cleanMessage(body);
  if (!text) return fail("support.errors.empty");
  const db = createAdminClient();
  const before = await threadState(user.id);
  const { data: threadId, error } = await db.rpc("post_support_message", { p_user: user.id, p_sender: user.id, p_from_admin: false, p_body: text });
  if (error) return fail("support.errors.generic");
  // A new chat starts with the assistant (the column's default); a closed one comes back to it too.
  const mode: ThreadMode = before ? before.mode : "ai";
  if (mode === "ai" && (await assistantOn())) {
    await answerWithAi(threadId as string, asChatUser(user));
    return { ok: true };
  }
  if (!before || before.unread === 0 || mode === "ai") {
    const to = before?.mode === "human" && before.assignedTo ? [before.assignedTo] : await adminIdsWith("support.view");
    await notifyWithPush(to, "support_message_admin", { name: user.name, reason: preview(text) }, `/admin/support?thread=${threadId as string}`, user.id);
  }
  return { ok: true };
}

/** "Talk to a person": the chat goes to the team at once. */
export async function askForPerson(): Promise<{ ok: true } | Fail> {
  const user = await chatUser();
  if (!user) return fail("support.errors.signIn");
  const db = createAdminClient();
  const before = await threadState(user.id);
  if (before && before.mode !== "ai") return { ok: true };
  let threadId: string | null = null;
  if (!before) {
    // No chat yet: start one, so the team has somewhere to answer.
    const { data } = await db.from("support_threads").upsert({ user_id: user.id }, { onConflict: "user_id" }).select("id").single();
    threadId = (data?.id as string | undefined) ?? null;
  } else {
    const { data } = await db.from("support_threads").select("id").eq("user_id", user.id).single();
    threadId = (data?.id as string | undefined) ?? null;
  }
  if (!threadId) return fail("support.errors.generic");
  const t = await translatorFor(user.locale === "bn" ? "bn" : "en");
  await handOver(threadId, asChatUser(user), "Asked to talk to a person.", t("support.ai.handedOver"));
  return { ok: true };
}

/** The chat as the user sees it, and marks the team's messages read (used when the chat is open). */
export async function loadMyChat(): Promise<{ ok: true; thread: SupportThread | null; messages: SupportMessage[]; assistant: boolean } | Fail> {
  const user = await chatUser();
  if (!user) return fail("support.errors.signIn");
  const [chat, assistant] = await Promise.all([myConversation(user.id), assistantOn()]);
  if (chat.thread && chat.thread.unreadByUser > 0) await createAdminClient().from("support_threads").update({ unread_by_user: 0 }).eq("id", chat.thread.id);
  return { ok: true, ...chat, assistant };
}

/** Unread team messages, for the chat button's badge. */
export async function myUnreadCount(): Promise<number> {
  const user = await chatUser();
  if (!user) return 0;
  const { data } = await createAdminClient().from("support_threads").select("unread_by_user").eq("user_id", user.id).maybeSingle();
  return (data?.unread_by_user as number | undefined) ?? 0;
}

// ---- A-24 the support inbox -----------------------------------------------------------------------

/** A staff reply; the user gets a bell + push. Replying takes the chat (from the assistant, or when nobody has it). */
export async function replySupport(threadId: string, body: string): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("support.manage");
  if (!admin || !UUID.test(threadId)) return fail("auth.errors.generic");
  const text = cleanMessage(body);
  if (!text) return fail("support.errors.empty");
  const db = createAdminClient();
  const { data: thread } = await db.from("support_threads").select("user_id").eq("id", threadId).maybeSingle();
  if (!thread) return fail("auth.errors.generic");
  const { error } = await db.rpc("post_support_message", { p_user: thread.user_id as string, p_sender: admin.id, p_from_admin: true, p_body: text });
  if (error) return fail("admin.errors.generic");
  await db.from("support_threads").update({ unread_by_admin: 0 }).eq("id", threadId);
  // Before migration 0058 there are no such columns; nothing to do then.
  const { data: state } = await db.from("support_threads").select("mode, assigned_to").eq("id", threadId).maybeSingle();
  if (state && (state.mode !== "human" || !state.assigned_to)) {
    await db.from("support_threads").update({ mode: "human", assigned_to: state.assigned_to ?? admin.id, assigned_at: new Date().toISOString() }).eq("id", threadId);
  }
  await notifyWithPush([thread.user_id as string], "support_reply", { reason: preview(text) }, "/support");
  await audit(admin.id, "support_reply", "support_thread", threadId);
  refresh();
  return { ok: true };
}

/** Opening a conversation marks the user's messages read for the team. */
export async function markThreadRead(threadId: string): Promise<void> {
  const admin = await adminUser("support.view");
  if (!admin || !UUID.test(threadId)) return;
  await createAdminClient().from("support_threads").update({ unread_by_admin: 0 }).eq("id", threadId).gt("unread_by_admin", 0);
}

export async function setThreadStatus(threadId: string, status: "open" | "closed"): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("support.manage");
  if (!admin || !UUID.test(threadId) || (status !== "open" && status !== "closed")) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { error } = await db.from("support_threads").update({ status, ...(status === "closed" ? { unread_by_admin: 0 } : {}) }).eq("id", threadId);
  if (error) return fail("admin.errors.generic");
  // A closed chat goes back to the assistant: the person's next message starts fresh (owner, 2026-10-15).
  if (status === "closed") await db.from("support_threads").update({ mode: "ai", assigned_to: null, assigned_at: null, handover_reason: null }).eq("id", threadId);
  refresh();
  return { ok: true };
}

/**
 * Gives a chat to a staff member (owner, 2026-10-15): "Assign to me", or a colleague who handles support. That person
 * chats from now on and gets the bell + push for new messages.
 */
export async function assignThread(threadId: string, staffId: string | "me"): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("support.manage");
  if (!admin || !UUID.test(threadId)) return fail("auth.errors.generic");
  const to = staffId === "me" ? admin.id : staffId;
  if (!UUID.test(to) || !(await adminIdsWith("support.manage")).includes(to)) return fail("admin.support.errors.staff");
  const db = createAdminClient();
  const { data: thread } = await db.from("support_threads").select("user_id, handover_reason").eq("id", threadId).maybeSingle();
  if (!thread) return fail("auth.errors.generic");
  const { error } = await db.from("support_threads").update({ mode: "human", assigned_to: to, assigned_at: new Date().toISOString(), status: "open" }).eq("id", threadId);
  if (error) return fail("admin.errors.generic");
  if (to !== admin.id) {
    const { data: u } = await db.from("profiles").select("name").eq("id", thread.user_id as string).maybeSingle();
    await notifyWithPush([to], "support_assigned_admin", { name: (u?.name as string | undefined) ?? "", reason: preview((thread.handover_reason as string | null) ?? "") }, `/admin/support?thread=${threadId}`, admin.id);
  }
  await audit(admin.id, "support_assign", "support_thread", threadId, { to });
  refresh();
  return { ok: true };
}

/** Gives the chat back to the AI assistant: it answers the person's next message again. */
export async function backToAssistant(threadId: string): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("support.manage");
  if (!admin || !UUID.test(threadId)) return fail("auth.errors.generic");
  const { error } = await createAdminClient().from("support_threads").update({ mode: "ai", assigned_to: null, assigned_at: null, handover_reason: null, unread_by_admin: 0 }).eq("id", threadId);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "support_to_ai", "support_thread", threadId);
  refresh();
  return { ok: true };
}

/** For the inbox's live view: the latest messages of one conversation. */
export async function loadThread(threadId: string) {
  const admin = await adminUser("support.view");
  if (!admin) return null;
  return threadDetail(threadId);
}

// ---- A-25 messages to users -----------------------------------------------------------------------

/** Finds one client or designer by mobile number, username or email (for "One person"). */
async function findPerson(query: string): Promise<{ id: string; name: string } | null> {
  const q = query.trim();
  if (!q) return null;
  const db = createAdminClient();
  const mobile = normalizeBdMobile(q);
  const filter = UUID.test(q) ? db.from("profiles").select("id, name, role").eq("id", q) : mobile ? db.from("profiles").select("id, name, role").eq("mobile", mobile) : q.includes("@") ? db.from("profiles").select("id, name, role").ilike("email", q) : db.from("profiles").select("id, name, role").ilike("username", q.replace(/^@/, ""));
  const { data } = await filter.maybeSingle();
  return data && (data.role === "client" || data.role === "designer") ? { id: data.id as string, name: data.name as string } : null;
}

export type PersonHit = { id: string; name: string; username: string | null; mobile: string | null; email: string | null; role: "client" | "designer"; avatar: string | null; banned: boolean };

/**
 * A-25 "One person" picker (owner, 2026-10-10): clients and designers by name, username, email or mobile.
 * With nothing typed it lists the newest people, so the admin can pick without knowing what to search.
 */
export async function searchPeople(query: string, role: "all" | "client" | "designer" = "all"): Promise<PersonHit[]> {
  if (!(await adminUser("messages.view"))) return [];
  // Characters that would break the PostgREST filter are dropped.
  const q = query.replace(/[,()*%\\"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  let req = createAdminClient()
    .from("profiles")
    .select("id, name, username, mobile, email, role, avatar_path, status")
    .in("role", role === "all" ? ["client", "designer"] : [role])
    .order("created_at", { ascending: false })
    .limit(30);
  if (q) {
    const like = `"%${q.replace(/^@/, "")}%"`;
    const parts = [`name.ilike.${like}`, `username.ilike.${like}`, `email.ilike.${like}`];
    const mobile = normalizeBdMobile(q);
    const digits = q.replace(/\D/g, "").replace(/^(880|0)/, "");
    if (mobile) parts.push(`mobile.eq."${mobile}"`);
    else if (digits.length >= 3) parts.push(`mobile.ilike."%${digits}%"`);
    if (UUID.test(q)) parts.push(`id.eq.${q}`);
    req = req.or(parts.join(","));
  }
  const { data } = await req;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    username: (p.username as string | null) ?? null,
    mobile: p.mobile ? formatMobile(p.mobile as string) : null,
    email: (p.email as string | null) ?? null,
    role: p.role as "client" | "designer",
    avatar: avatarUrl(p.avatar_path as string | null),
    banned: p.status === "banned",
  }));
}

/** Sends a message to a group or one person: into each support chat, plus a bell + push. */
export async function sendBroadcast(input: { audience: string; person: string; body: string }): Promise<{ ok: true; recipients: number } | Fail> {
  const admin = await adminUser("messages.manage");
  if (!admin || !isAudience(input.audience)) return fail("auth.errors.generic");
  const text = cleanMessage(input.body);
  if (!text) return fail("support.errors.empty");
  let target: { id: string; name: string } | null = null;
  if (input.audience === "one") {
    target = await findPerson(input.person);
    if (!target) return fail("admin.messages.errors.person");
  }
  const db = createAdminClient();
  const { data: broadcastId, error } = await db.rpc("broadcast_message", { p_admin: admin.id, p_audience: input.audience, p_target: target?.id ?? null, p_body: text });
  if (error || !broadcastId) return fail("admin.errors.generic");
  const { data: row } = await db.from("broadcasts").select("recipients").eq("id", broadcastId as string).single();
  const recipients = (row?.recipients as number | undefined) ?? 0;

  // Who got it (from their chats), for the bell + push.
  const { data: got } = await db.from("support_messages").select("thread:support_threads(user_id)").eq("broadcast_id", broadcastId as string).limit(20000);
  const ids = (got ?? []).map((g) => (Array.isArray(g.thread) ? g.thread[0] : g.thread) as { user_id: string } | null).filter((x): x is { user_id: string } => !!x).map((x) => x.user_id);
  await notifyWithPush(ids, "admin_message", { reason: preview(text) }, "/support", admin.id);
  await audit(admin.id, "send_message", "broadcast", broadcastId as string, { audience: input.audience, target: target?.id ?? null, recipients });
  refresh();
  return { ok: true, recipients };
}
