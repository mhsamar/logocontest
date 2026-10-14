import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Logins and devices (owner, 2026-10-14; migration 0055). */

export type EndReason = "logout" | "device_limit" | "one_device" | "admin" | "idle" | "tab_closed" | "password_reset" | "deleted" | "time_up";

/** This browser's login id, or null. */
export async function currentSessionId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await (await createClient()).auth.getClaims();
  return (data?.claims?.session_id as string | undefined) ?? null;
}

/** Signs these logins out at once (their refresh tokens stop working too). */
export async function endSessions(ids: string[], reason: EndReason): Promise<number> {
  if (!ids.length) return 0;
  const { data, error } = await createAdminClient().rpc("end_sessions", { p_ids: ids, p_reason: reason });
  if (error) {
    console.error("[sessions] end:", error.message);
    return 0;
  }
  return (data as number | null) ?? 0;
}

/** Every login of this person (an admin's "Sign out of all devices", a new password, a deleted account). */
export async function endAllSessions(userId: string, reason: EndReason): Promise<number> {
  const { data } = await createAdminClient().from("user_sessions").select("id").eq("user_id", userId).is("ended_at", null);
  return endSessions((data ?? []).map((r) => r.id as string), reason);
}

/** Log out: this login is marked as ended by the person themselves. Never throws. */
export async function markLoggedOut(): Promise<void> {
  try {
    const id = await currentSessionId();
    if (id) await createAdminClient().from("user_sessions").update({ ended_at: new Date().toISOString(), end_reason: "logout" }).eq("id", id).is("ended_at", null);
  } catch (e) {
    console.error("[sessions] logout:", e instanceof Error ? e.message : e);
  }
}

export type SessionRow = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  endReason: EndReason | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  device: "mobile" | "tablet" | "desktop" | null;
  browser: string | null;
  os: string | null;
  activeSeconds: number;
  impersonatedBy: string | null;
};

export const SESSION_COLUMNS = "id, created_at, last_seen_at, ended_at, end_reason, ip, country, city, device, browser, os, active_seconds, impersonator:profiles!impersonated_by(name)";

export function toSessionRow(r: Record<string, unknown>): SessionRow {
  const imp = r.impersonator as { name: string } | { name: string }[] | null;
  return {
    id: r.id as string,
    createdAt: new Date(r.created_at as string),
    lastSeenAt: new Date(r.last_seen_at as string),
    endedAt: r.ended_at ? new Date(r.ended_at as string) : null,
    endReason: (r.end_reason as EndReason | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    device: (r.device as SessionRow["device"]) ?? null,
    browser: (r.browser as string | null) ?? null,
    os: (r.os as string | null) ?? null,
    activeSeconds: (r.active_seconds as number) ?? 0,
    impersonatedBy: (Array.isArray(imp) ? imp[0]?.name : imp?.name) ?? null,
  };
}

/** One person's logins, the ones still open first. Empty before migration 0055. */
export async function userSessions(userId: string, limit = 30): Promise<SessionRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient().from("user_sessions").select(SESSION_COLUMNS).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  const rows = data.map((r) => toSessionRow(r as Record<string, unknown>));
  return [...rows.filter((r) => !r.endedAt), ...rows.filter((r) => r.endedAt)];
}

/** The login id inside an access token, without checking it (only to look up why a login stopped working). */
export function sessionIdOfToken(token: string | null | undefined): string | null {
  try {
    const part = (token ?? "").split(".")[1];
    if (!part) return null;
    const id = (JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { session_id?: unknown }).session_id;
    return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Why this login was signed out, or null when it wasn't (or isn't one of ours). */
export async function endReasonOf(sessionId: string | null): Promise<EndReason | null> {
  if (!sessionId) return null;
  const { data } = await createAdminClient().from("user_sessions").select("end_reason").eq("id", sessionId).not("ended_at", "is", null).maybeSingle();
  return (data?.end_reason as EndReason | undefined) ?? null;
}
