import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { avatarUrl } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseContestChat } from "./rules";
import { getProSettings } from "./settings";
import { isPro, proIdsAmong } from "./status";

export const PRO_FILES_BUCKET = "pro-files";
const db = () => createAdminClient();
const UUID = /^[0-9a-f-]{36}$/i;

export type ChatContext = {
  entryId: string;
  entryNumber: number;
  contestId: string;
  contestSlug: string;
  brand: string;
  contestStatus: string;
  clientId: string;
  designerId: string;
  /** The other person, as the viewer sees them. */
  other: { id: string; name: string; avatarUrl: string | null; online: boolean; business: string | null };
  thumb: string | null;
};

/**
 * May this person use the chat about this entry? Only the contest's client and the designer who sent the entry,
 * only while the designer is Pro with "Messages from contest clients" on and the feature is on (Admin › Pro plan).
 * Admins can read every chat (Pro plan permission) but never write.
 */
export async function chatContext(entryId: string, viewer: CurrentUser | null): Promise<ChatContext | null> {
  if (!viewer || !UUID.test(entryId)) return null;
  const { settings, ready } = await getProSettings();
  if (!ready) return null;
  const { data: e } = await db()
    .from("entries")
    .select("id, number, contest_id, designer_id, status, contest:contests!contest_id(id, slug, brand_name, status, client_id)")
    .eq("id", entryId)
    .maybeSingle();
  if (!e) return null;
  const c = (Array.isArray(e.contest) ? e.contest[0] : e.contest) as { id: string; slug: string; brand_name: string; status: string; client_id: string } | null;
  if (!c) return null;
  const designerId = e.designer_id as string;
  const [pro, { data: pref }] = await Promise.all([isPro(designerId), db().from("pro_preferences").select("client_messages").eq("designer_id", designerId).maybeSingle()]);
  const allowed = canUseContestChat({
    viewerId: viewer.id,
    contestClientId: c.client_id,
    entryDesignerId: designerId,
    entryContestId: e.contest_id as string,
    contestId: c.id,
    designerIsPro: pro,
    designerAllowsMessages: pref?.client_messages !== false,
    featureOn: settings.features.client_chat,
  });
  if (!allowed) return null;
  const otherId = viewer.id === c.client_id ? designerId : c.client_id;
  const [{ data: other }, { data: img }] = await Promise.all([
    db().from("profiles").select("id, name, avatar_path, last_seen_at").eq("id", otherId).maybeSingle(),
    db().from("entry_images").select("preview_path").eq("entry_id", entryId).order("position").limit(1).maybeSingle(),
  ]);
  const thumbs = img?.preview_path ? await getFileStorage().createReadUrls("entry-files", [img.preview_path as string], 3600).catch(() => new Map<string, string>()) : new Map<string, string>();
  return {
    entryId,
    entryNumber: e.number as number,
    contestId: c.id,
    contestSlug: c.slug,
    brand: c.brand_name,
    contestStatus: c.status,
    clientId: c.client_id,
    designerId,
    other: {
      id: otherId,
      name: ((other?.name as string | null) ?? "").trim(),
      avatarUrl: avatarUrl((other?.avatar_path as string | null) ?? null),
      online: Boolean(other?.last_seen_at && Date.now() - new Date(other.last_seen_at as string).getTime() < 5 * 60_000),
      // The designer sees this contest's brand (owner, 2026-10-15: a client can run contests for several businesses).
      business: viewer.id === designerId ? c.brand_name : null,
    },
    thumb: img?.preview_path ? (thumbs.get(img.preview_path as string) ?? null) : null,
  };
}

export type ChatMessage = { id: string; mine: boolean; body: string; file: { name: string; size: number; url: string | null } | null; flags: string[]; at: string; read: boolean };

/** The messages of one chat, oldest first, with short-lived links to the files. Marks the other side's as read. */
export async function chatMessages(ctx: ChatContext, viewerId: string): Promise<ChatMessage[]> {
  const { data } = await db().from("contest_messages").select("id, sender_id, body, file_path, file_name, file_size, flags, read_at, created_at").eq("entry_id", ctx.entryId).order("created_at").limit(500);
  const rows = data ?? [];
  const paths = rows.map((r) => r.file_path as string | null).filter((p): p is string => Boolean(p));
  const urls = paths.length ? await getFileStorage().createReadUrls(PRO_FILES_BUCKET, paths, 3600).catch(() => new Map<string, string>()) : new Map<string, string>();
  const unread = rows.filter((r) => r.sender_id !== viewerId && !r.read_at).map((r) => r.id as string);
  if (unread.length) await db().from("contest_messages").update({ read_at: new Date().toISOString() }).in("id", unread);
  return rows.map((r) => ({
    id: r.id as string,
    mine: r.sender_id === viewerId,
    body: (r.body as string) ?? "",
    file: r.file_path ? { name: (r.file_name as string) ?? "file", size: (r.file_size as number) ?? 0, url: urls.get(r.file_path as string) ?? null } : null,
    flags: (r.flags as string[]) ?? [],
    at: r.created_at as string,
    read: Boolean(r.read_at),
  }));
}

export type ChatThread = {
  entryId: string;
  entryNumber: number;
  brand: string;
  /** The contest (owner, 2026-10-16: the client's Messages groups chats by contest). */
  contestSlug: string;
  other: { id: string; name: string; avatarUrl: string | null };
  last: string;
  lastAt: string;
  unread: number;
};

/** Every chat this person is in (designer: their entries; client: their contests), newest first. */
export async function chatThreads(viewer: CurrentUser): Promise<ChatThread[]> {
  const { ready } = await getProSettings();
  if (!ready) return [];
  const col = viewer.role === "client" ? "client_id" : "designer_id";
  const { data } = await db()
    .from("contest_messages")
    .select("entry_id, client_id, designer_id, sender_id, body, file_name, read_at, created_at, entry:entries!entry_id(number), contest:contests!contest_id(brand_name, slug)")
    .eq(col, viewer.id)
    .order("created_at", { ascending: false })
    .limit(1000);
  const byEntry = new Map<string, ChatThread & { otherId: string }>();
  for (const r of data ?? []) {
    const id = r.entry_id as string;
    const unread = r.sender_id !== viewer.id && !r.read_at ? 1 : 0;
    const t = byEntry.get(id);
    if (t) {
      t.unread += unread;
      continue;
    }
    const entry = (Array.isArray(r.entry) ? r.entry[0] : r.entry) as { number: number } | null;
    const contest = (Array.isArray(r.contest) ? r.contest[0] : r.contest) as { brand_name: string; slug: string } | null;
    const otherId = (viewer.role === "client" ? r.designer_id : r.client_id) as string;
    byEntry.set(id, {
      entryId: id,
      entryNumber: entry?.number ?? 0,
      brand: contest?.brand_name ?? "",
      contestSlug: contest?.slug ?? "",
      other: { id: otherId, name: "", avatarUrl: null },
      otherId,
      last: (r.body as string) || (r.file_name as string) || "",
      lastAt: r.created_at as string,
      unread,
    });
  }
  const threads = [...byEntry.values()];
  const ids = [...new Set(threads.map((t) => t.otherId))];
  const { data: people } = ids.length ? await db().from("profiles").select("id, name, avatar_path").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id as string, { id: p.id as string, name: ((p.name as string) ?? "").trim(), avatarUrl: avatarUrl(p.avatar_path as string | null) }]));
  return threads.map(({ otherId, ...t }) => ({ ...t, other: who.get(otherId) ?? t.other }));
}

/** Unread contest-chat messages for the menu badge. */
export async function unreadChats(viewer: CurrentUser): Promise<number> {
  const { ready } = await getProSettings();
  if (!ready) return 0;
  const col = viewer.role === "client" ? "client_id" : "designer_id";
  const { count } = await db().from("contest_messages").select("id", { count: "exact", head: true }).eq(col, viewer.id).neq("sender_id", viewer.id).is("read_at", null);
  return count ?? 0;
}

/** Entries of this contest whose designer can be messaged (for the client's "Message designer" button). */
export async function chattableEntries(contestId: string, viewer: CurrentUser | null): Promise<Set<string>> {
  const { settings, ready } = await getProSettings();
  if (!ready || !viewer || viewer.role !== "client" || !settings.features.client_chat) return new Set();
  const { data: c } = await db().from("contests").select("client_id").eq("id", contestId).maybeSingle();
  if (!c || c.client_id !== viewer.id) return new Set();
  const { data: entries } = await db().from("entries").select("id, designer_id").eq("contest_id", contestId).not("status", "in", "(removed,withdrawn)");
  const ids = [...new Set((entries ?? []).map((e) => e.designer_id as string))];
  if (!ids.length) return new Set();
  // Pro plan or the free Pro Trial (owner, 2026-10-16): the trial gives every Pro feature, this chat too.
  const pro = await proIdsAmong(ids);
  const { data: off } = await db().from("pro_preferences").select("designer_id").in("designer_id", [...pro]).eq("client_messages", false);
  for (const r of off ?? []) pro.delete(r.designer_id as string);
  return new Set((entries ?? []).filter((e) => pro.has(e.designer_id as string)).map((e) => e.id as string));
}
