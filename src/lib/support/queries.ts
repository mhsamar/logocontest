import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { getProSettings } from "@/lib/pro/settings";
import { proIdsAmong } from "@/lib/pro/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { isThreadMode, type ThreadMode } from "./ai-rules";

/** `ai`: written by the AI assistant (owner, 2026-10-15). */
export type SupportMessage = { id: string; fromAdmin: boolean; body: string; createdAt: string; senderName: string | null; broadcast: boolean; ai: boolean };
/**
 * `mode` (owner, 2026-10-15): "ai" the assistant answers, "waiting" handed to the team with nobody assigned yet,
 * "human" a staff member (`assignedTo`) has it. Before migration 0058 every chat is "human".
 */
export type SupportThread = {
  id: string;
  status: "open" | "closed";
  unreadByUser: number;
  unreadByAdmin: number;
  lastMessageAt: string;
  mode: ThreadMode;
  assignedTo: string | null;
  assignedName: string | null;
  handoverReason: string | null;
};

const MESSAGE_COLS = "id, from_admin, body, created_at, broadcast_id, is_ai, sender:profiles!support_messages_sender_id_fkey(name)";
const OLD_MESSAGE_COLS = "id, from_admin, body, created_at, broadcast_id, sender:profiles!support_messages_sender_id_fkey(name)";
const THREAD_COLS = "id, status, unread_by_user, unread_by_admin, last_message_at, mode, assigned_to, handover_reason, assignee:profiles!support_threads_assigned_to_fkey(name)";
const OLD_THREAD_COLS = "id, status, unread_by_user, unread_by_admin, last_message_at";

function toMessages(rows: Record<string, unknown>[]): SupportMessage[] {
  return rows.map((r) => {
    const sender = Array.isArray(r.sender) ? r.sender[0] : r.sender;
    return {
      id: r.id as string,
      fromAdmin: r.from_admin as boolean,
      body: r.body as string,
      createdAt: r.created_at as string,
      senderName: (sender as { name?: string } | null)?.name ?? null,
      broadcast: !!r.broadcast_id,
      ai: r.is_ai === true,
    };
  });
}

async function messagesOf(threadId: string, limit = 200): Promise<SupportMessage[]> {
  const db = createAdminClient();
  const ask = (cols: string) => db.from("support_messages").select(cols).eq("thread_id", threadId).order("created_at", { ascending: false }).limit(limit);
  let { data, error } = await ask(MESSAGE_COLS);
  if (error) ({ data, error } = await ask(OLD_MESSAGE_COLS));
  return toMessages(((data ?? []) as unknown as Record<string, unknown>[]).reverse());
}

const toThread = (r: Record<string, unknown>): SupportThread => {
  const assignee = (Array.isArray(r.assignee) ? r.assignee[0] : r.assignee) as { name?: string } | null | undefined;
  return {
    id: r.id as string,
    status: r.status as SupportThread["status"],
    unreadByUser: r.unread_by_user as number,
    unreadByAdmin: r.unread_by_admin as number,
    lastMessageAt: r.last_message_at as string,
    mode: isThreadMode(r.mode) ? r.mode : "human",
    assignedTo: (r.assigned_to as string | null) ?? null,
    assignedName: assignee?.name ?? null,
    handoverReason: (r.handover_reason as string | null) ?? null,
  };
};

/** One thread row by a filter, with the assistant's columns when migration 0058 has run. */
async function threadRow(column: "id" | "user_id", value: string, extra = ""): Promise<Record<string, unknown> | null> {
  const db = createAdminClient();
  const ask = (cols: string) => db.from("support_threads").select(cols + extra).eq(column, value).maybeSingle();
  let { data, error } = await ask(THREAD_COLS);
  if (error) ({ data, error } = await ask(OLD_THREAD_COLS));
  return (data as Record<string, unknown> | null) ?? null;
}

/** S-01: the signed-in user's own conversation (empty until the first message). */
export async function myConversation(userId: string): Promise<{ thread: SupportThread | null; messages: SupportMessage[] }> {
  if (!isSupabaseConfigured()) return { thread: null, messages: [] };
  const data = await threadRow("user_id", userId);
  if (!data) return { thread: null, messages: [] };
  return { thread: toThread(data), messages: await messagesOf(data.id as string) };
}

export async function myUnread(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { data } = await createAdminClient().from("support_threads").select("unread_by_user").eq("user_id", userId).maybeSingle();
  return (data?.unread_by_user as number | undefined) ?? 0;
}

// ---- A-24 Support inbox ------------------------------------------------------------------------

export type InboxRow = SupportThread & { user: { id: string; name: string; role: string; username: string | null; mobile: string | null } | null; last: string | null; pro: boolean };

/** The inbox lists (owner, 2026-10-15): open chats, the ones waiting for a person, mine, and closed ones. */
export type InboxView = "open" | "needs" | "mine" | "closed";

export async function inbox(view: InboxView, meId: string, limit = 100): Promise<InboxRow[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const USER = ", user:profiles!support_threads_user_id_fkey(id, name, role, username, mobile)";
  const ask = (cols: string, withMode: boolean) => {
    let q = db
      .from("support_threads")
      .select(cols + USER)
      .eq("status", view === "closed" ? "closed" : "open");
    if (withMode && view === "needs") q = q.eq("mode", "waiting");
    if (withMode && view === "mine") q = q.eq("assigned_to", meId);
    return q.order("last_message_at", { ascending: false }).limit(limit);
  };
  let { data, error } = await ask(THREAD_COLS, true);
  if (error) ({ data, error } = await ask(OLD_THREAD_COLS, false));
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  // The newest message of each conversation, for the preview line.
  const ids = rows.map((r) => r.id as string);
  const last = new Map<string, string>();
  if (ids.length) {
    const { data: msgs } = await db.from("support_messages").select("thread_id, body, created_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(ids.length * 3);
    for (const m of msgs ?? []) if (!last.has(m.thread_id as string)) last.set(m.thread_id as string, m.body as string);
  }
  // Priority support (owner, 2026-10-13: Designer Pro plan): Pro designers' conversations come first, with a Pro tag.
  const { settings, ready } = await getProSettings();
  const userOf = (r: Record<string, unknown>) => (Array.isArray(r.user) ? r.user[0] : r.user) as InboxRow["user"];
  const pro = ready && settings.features.priority_support ? await proIdsAmong(rows.map((r) => userOf(r)?.id ?? "").filter(Boolean)) : new Set<string>();
  const out = rows.map((r) => {
    const user = userOf(r);
    return { ...toThread(r), user: user ?? null, last: last.get(r.id as string) ?? null, pro: Boolean(user && pro.has(user.id)) };
  });
  return [...out.filter((r) => r.pro), ...out.filter((r) => !r.pro)];
}

export type ThreadDetail = { thread: SupportThread & { userId: string }; user: { id: string; name: string; role: string; username: string | null; mobile: string | null; email: string | null; status: string; createdAt: string }; messages: SupportMessage[] };

export async function threadDetail(threadId: string): Promise<ThreadDetail | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(threadId)) return null;
  const db = createAdminClient();
  const data = await threadRow("id", threadId, ", user_id");
  if (!data) return null;
  const [{ data: u }, messages] = await Promise.all([
    db.from("profiles").select("id, name, role, username, mobile, email, status, created_at").eq("id", data.user_id as string).single(),
    messagesOf(threadId),
  ]);
  if (!u) return null;
  return {
    thread: { ...toThread(data), userId: data.user_id as string },
    user: { id: u.id, name: u.name, role: u.role, username: u.username, mobile: u.mobile, email: u.email, status: u.status, createdAt: u.created_at },
    messages,
  };
}

/** The conversation id for a user, if they have one (for "Open chat" from a profile). */
export async function threadIdOf(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("support_threads").select("id").eq("user_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type BroadcastRow = { id: string; audience: string; body: string; recipients: number; createdAt: string; adminName: string | null; targetName: string | null };

export async function recentBroadcasts(limit = 50): Promise<BroadcastRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("broadcasts")
    .select("id, audience, body, recipients, created_at, admin:profiles!broadcasts_admin_id_fkey(name), target:profiles!broadcasts_target_user_fkey(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => {
    const admin = Array.isArray(r.admin) ? r.admin[0] : r.admin;
    const target = Array.isArray(r.target) ? r.target[0] : r.target;
    return {
      id: r.id as string,
      audience: r.audience as string,
      body: r.body as string,
      recipients: r.recipients as number,
      createdAt: r.created_at as string,
      adminName: (admin as { name?: string } | null)?.name ?? null,
      targetName: (target as { name?: string } | null)?.name ?? null,
    };
  });
}

/** Staff who can answer support chats (for "Assign to…"). */
export async function supportStaff(): Promise<{ id: string; name: string }[]> {
  if (!isSupabaseConfigured()) return [];
  const { adminIdsWith } = await import("@/lib/admin/recipients");
  const ids = await adminIdsWith("support.manage");
  if (!ids.length) return [];
  const { data } = await createAdminClient().from("profiles").select("id, name").in("id", ids).order("name");
  return (data ?? []).map((p) => ({ id: p.id as string, name: ((p.name as string | null) ?? "").trim() || "—" }));
}
