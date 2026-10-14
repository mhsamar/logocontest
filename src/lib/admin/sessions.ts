import "server-only";
import { SESSION_COLUMNS, toSessionRow, type SessionRow } from "@/lib/auth/sessions";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** Admin › Sign-ins and Admin › Staff activity (owner, 2026-10-14; migration 0055). */

const db = () => createAdminClient();
const PAGE = 50;
const DAY = 86_400_000;

export type SignInRow = SessionRow & { user: { id: string; name: string; username: string | null; role: string } | null };
export type SignInQuery = { role: "all" | "client" | "designer" | "admin"; status: "all" | "open" | "ended"; q: string; page: number };

export function signInQuery(sp: Record<string, string | string[] | undefined>): SignInQuery {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const role = str(sp.role);
  const status = str(sp.status);
  return {
    role: role === "client" || role === "designer" || role === "admin" ? role : "all",
    status: status === "open" || status === "ended" ? status : "all",
    q: str(sp.q).trim().slice(0, 60),
    page: Math.max(1, Math.min(500, Math.floor(Number(sp.page)) || 1)),
  };
}

export async function signIns(q: SignInQuery): Promise<{ rows: SignInRow[]; total: number; pages: number }> {
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pages: 1 };
  const inner = q.role !== "all" || q.q;
  let query = db()
    .from("user_sessions")
    .select(`${SESSION_COLUMNS}, user:profiles!user_id${inner ? "!inner" : ""}(id, name, username, role)`, { count: "exact" });
  if (q.role !== "all") query = query.eq("user.role", q.role);
  if (q.q) {
    const term = q.q.replace(/[%,()]/g, "");
    query = query.or(`name.ilike.%${term}%,username.ilike.%${term}%`, { referencedTable: "user" });
  }
  if (q.status === "open") query = query.is("ended_at", null);
  if (q.status === "ended") query = query.not("ended_at", "is", null);
  const from = (q.page - 1) * PAGE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  if (error || !data) return { rows: [], total: 0, pages: 1 };
  return {
    rows: data.map((r) => ({ ...toSessionRow(r as Record<string, unknown>), user: one(r.user as SignInRow["user"] | SignInRow["user"][]) ?? null })),
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
  };
}

export type StaffSummary = { id: string; name: string; title: string | null; superAdmin: boolean; active: boolean; signIns: number; activeSeconds: number; lastSeen: Date | null; actions: number; online: boolean };

/** Every staff member with their logins, working time and actions in the last `days` days. */
export async function staffActivity(days: number, now = new Date()): Promise<StaffSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const since = new Date(now.getTime() - days * DAY).toISOString();
  const { data: staff } = await db().from("profiles").select("id, name, admin_title, is_super_admin, admin_active, status").eq("role", "admin").order("created_at");
  const ids = (staff ?? []).map((s) => s.id as string);
  if (!ids.length) return [];
  const [{ data: sessions }, { data: actions }] = await Promise.all([
    db().from("user_sessions").select("user_id, created_at, last_seen_at, active_seconds, ended_at, impersonated_by").in("user_id", ids).gte("last_seen_at", since).limit(5000),
    db().from("audit_logs").select("admin_id").in("admin_id", ids).gte("created_at", since).limit(20000),
  ]);
  return (staff ?? []).map((s) => {
    const mine = (sessions ?? []).filter((r) => r.user_id === s.id && !r.impersonated_by);
    const last = mine.reduce<number>((m, r) => Math.max(m, new Date(r.last_seen_at as string).getTime()), 0);
    return {
      id: s.id as string,
      name: s.name as string,
      title: (s.admin_title as string | null)?.trim() || null,
      superAdmin: Boolean(s.is_super_admin),
      active: s.status === "active" && s.admin_active !== false,
      signIns: mine.filter((r) => new Date(r.created_at as string).getTime() >= now.getTime() - days * DAY).length,
      activeSeconds: mine.reduce((n, r) => n + ((r.active_seconds as number) ?? 0), 0),
      lastSeen: last ? new Date(last) : null,
      actions: (actions ?? []).filter((a) => a.admin_id === s.id).length,
      online: mine.some((r) => !r.ended_at && now.getTime() - new Date(r.last_seen_at as string).getTime() < 3 * 60_000),
    };
  });
}

export type StaffAction = { id: string; action: string; subjectType: string; subjectId: string | null; changes: Record<string, unknown>; createdAt: Date };

/** One staff member: their logins and everything they did (newest first). */
export async function staffDetail(id: string): Promise<{ name: string; title: string | null; superAdmin: boolean; sessions: SessionRow[]; actions: StaffAction[] } | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: p } = await db().from("profiles").select("name, role, admin_title, is_super_admin").eq("id", id).maybeSingle();
  if (!p || p.role !== "admin") return null;
  const [{ data: sessions }, { data: actions }] = await Promise.all([
    db().from("user_sessions").select(SESSION_COLUMNS).eq("user_id", id).order("created_at", { ascending: false }).limit(100),
    db().from("audit_logs").select("id, action, subject_type, subject_id, changes, created_at").eq("admin_id", id).order("created_at", { ascending: false }).limit(300),
  ]);
  return {
    name: p.name as string,
    title: (p.admin_title as string | null)?.trim() || null,
    superAdmin: Boolean(p.is_super_admin),
    sessions: (sessions ?? []).map((r) => toSessionRow(r as Record<string, unknown>)),
    actions: (actions ?? []).map((a) => ({
      id: a.id as string,
      action: a.action as string,
      subjectType: a.subject_type as string,
      subjectId: (a.subject_id as string | null) ?? null,
      changes: (a.changes as Record<string, unknown>) ?? {},
      createdAt: new Date(a.created_at as string),
    })),
  };
}
