import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type SupportMessage = { id: string; fromAdmin: boolean; body: string; createdAt: string; senderName: string | null; broadcast: boolean };
export type SupportThread = { id: string; status: "open" | "closed"; unreadByUser: number; unreadByAdmin: number; lastMessageAt: string };

const MESSAGE_COLS = "id, from_admin, body, created_at, broadcast_id, sender:profiles!support_messages_sender_id_fkey(name)";

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
    };
  });
}

async function messagesOf(threadId: string, limit = 200): Promise<SupportMessage[]> {
  const { data } = await createAdminClient().from("support_messages").select(MESSAGE_COLS).eq("thread_id", threadId).order("created_at", { ascending: false }).limit(limit);
  return toMessages((data ?? []).reverse() as Record<string, unknown>[]);
}

const toThread = (r: Record<string, unknown>): SupportThread => ({
  id: r.id as string,
  status: r.status as SupportThread["status"],
  unreadByUser: r.unread_by_user as number,
  unreadByAdmin: r.unread_by_admin as number,
  lastMessageAt: r.last_message_at as string,
});

/** S-01: the signed-in user's own conversation (empty until the first message). */
export async function myConversation(userId: string): Promise<{ thread: SupportThread | null; messages: SupportMessage[] }> {
  if (!isSupabaseConfigured()) return { thread: null, messages: [] };
  const { data } = await createAdminClient().from("support_threads").select("id, status, unread_by_user, unread_by_admin, last_message_at").eq("user_id", userId).maybeSingle();
  if (!data) return { thread: null, messages: [] };
  return { thread: toThread(data), messages: await messagesOf(data.id as string) };
}

export async function myUnread(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { data } = await createAdminClient().from("support_threads").select("unread_by_user").eq("user_id", userId).maybeSingle();
  return (data?.unread_by_user as number | undefined) ?? 0;
}

// ---- A-24 Support inbox ------------------------------------------------------------------------

export type InboxRow = SupportThread & { user: { id: string; name: string; role: string; username: string | null; mobile: string | null } | null; last: string | null };

export async function inbox(status: "open" | "closed", limit = 100): Promise<InboxRow[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("support_threads")
    .select("id, status, unread_by_user, unread_by_admin, last_message_at, user:profiles!support_threads_user_id_fkey(id, name, role, username, mobile)")
    .eq("status", status)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  // The newest message of each conversation, for the preview line.
  const ids = rows.map((r) => r.id as string);
  const last = new Map<string, string>();
  if (ids.length) {
    const { data: msgs } = await db.from("support_messages").select("thread_id, body, created_at").in("thread_id", ids).order("created_at", { ascending: false }).limit(ids.length * 3);
    for (const m of msgs ?? []) if (!last.has(m.thread_id as string)) last.set(m.thread_id as string, m.body as string);
  }
  return rows.map((r) => {
    const user = Array.isArray(r.user) ? r.user[0] : r.user;
    return { ...toThread(r), user: (user as InboxRow["user"]) ?? null, last: last.get(r.id as string) ?? null };
  });
}

export type ThreadDetail = { thread: SupportThread & { userId: string }; user: { id: string; name: string; role: string; username: string | null; mobile: string | null; email: string | null; status: string; createdAt: string }; messages: SupportMessage[] };

export async function threadDetail(threadId: string): Promise<ThreadDetail | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(threadId)) return null;
  const db = createAdminClient();
  const { data } = await db.from("support_threads").select("id, user_id, status, unread_by_user, unread_by_admin, last_message_at").eq("id", threadId).maybeSingle();
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
