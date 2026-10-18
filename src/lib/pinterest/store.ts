import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { openToken, refreshTokens, sealToken, type Tokens } from "./api";
import { needsRefresh } from "./rules";

/** The one Pinterest connection (owner, 2026-10-19; migration 0066). Tokens never leave this file unsealed except to call Pinterest. */

const db = () => createAdminClient();

export type ConnectionSummary = { username: string | null; boardId: string | null; boardName: string | null; connectedAt: Date; accessExpiresAt: Date | null; lastError: string | null };

/** False until the owner has run migration 0066. */
const missingTable = (message: string) => /does not exist|schema cache|Could not find the table/i.test(message);

export async function connectionSummary(): Promise<{ tableReady: boolean; conn: ConnectionSummary | null }> {
  const { data, error } = await db().from("pinterest_connection").select("account_username, board_id, board_name, connected_at, access_expires_at, last_error").maybeSingle();
  if (error) {
    if (missingTable(error.message)) return { tableReady: false, conn: null };
    throw new Error(error.message);
  }
  if (!data) return { tableReady: true, conn: null };
  return {
    tableReady: true,
    conn: {
      username: (data.account_username as string | null) ?? null,
      boardId: (data.board_id as string | null) ?? null,
      boardName: (data.board_name as string | null) ?? null,
      connectedAt: new Date(data.connected_at as string),
      accessExpiresAt: data.access_expires_at ? new Date(data.access_expires_at as string) : null,
      lastError: (data.last_error as string | null) ?? null,
    },
  };
}

const later = (seconds: number | undefined, now: Date) => (seconds ? new Date(now.getTime() + seconds * 1000).toISOString() : null);

/** Saves new tokens (connect or refresh). The chosen board stays. */
export async function saveTokens(t: Tokens, now: Date, extra: { username?: string | null; by?: string } = {}): Promise<void> {
  const row: Record<string, unknown> = {
    id: true,
    access_token_enc: sealToken(t.access_token),
    access_expires_at: later(t.expires_in, now),
    scope: t.scope ?? null,
    last_error: null,
    updated_at: now.toISOString(),
  };
  if (t.refresh_token) {
    row.refresh_token_enc = sealToken(t.refresh_token);
    row.refresh_expires_at = later(t.refresh_token_expires_in, now);
  }
  if (extra.by) {
    row.connected_by = extra.by;
    row.connected_at = now.toISOString();
    row.account_username = extra.username ?? null;
  }
  const { error } = await db().from("pinterest_connection").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** A working access token, refreshed first when it is about to end. */
export async function accessToken(now: Date): Promise<string> {
  const { data, error } = await db().from("pinterest_connection").select("access_token_enc, refresh_token_enc, access_expires_at").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Pinterest is not connected.");
  const token = openToken(data.access_token_enc as string);
  if (!token) throw new Error("The saved Pinterest login can't be read (the app secret changed). Connect Pinterest again.");
  const expires = data.access_expires_at ? new Date(data.access_expires_at as string) : null;
  if (!needsRefresh(expires, now)) return token;
  const refresh = data.refresh_token_enc ? openToken(data.refresh_token_enc as string) : null;
  if (!refresh) return token;
  const fresh = await refreshTokens(refresh);
  await saveTokens(fresh, now);
  return fresh.access_token;
}

export async function setBoard(boardId: string, boardName: string): Promise<void> {
  const { error } = await db().from("pinterest_connection").update({ board_id: boardId, board_name: boardName, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) throw new Error(error.message);
}

export async function noteError(message: string | null): Promise<void> {
  await db().from("pinterest_connection").update({ last_error: message ? message.slice(0, 300) : null }).eq("id", true);
}

export async function clearConnection(): Promise<void> {
  const { error } = await db().from("pinterest_connection").delete().eq("id", true);
  if (error) throw new Error(error.message);
}

export type PinLogRow = { id: string; kind: "winner" | "design"; status: "queued" | "posted" | "failed"; pinId: string | null; attempts: number; lastError: string | null; at: Date; slug: string; brand: string; number: number };

export async function pinLog(limit = 30): Promise<PinLogRow[]> {
  const { data, error } = await db()
    .from("pinterest_pins")
    .select("id, kind, status, pin_id, attempts, last_error, created_at, tried_at, posted_at, entry:entries!entry_id(number, contest:contests!contest_id(slug, brand_name))")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).flatMap((r) => {
    const e = (Array.isArray(r.entry) ? r.entry[0] : r.entry) as { number: number; contest: { slug: string; brand_name: string } | { slug: string; brand_name: string }[] } | null;
    const c = e ? (Array.isArray(e.contest) ? e.contest[0] : e.contest) : null;
    if (!e || !c) return [];
    return [{ id: r.id as string, kind: r.kind as PinLogRow["kind"], status: r.status as PinLogRow["status"], pinId: (r.pin_id as string | null) ?? null, attempts: r.attempts as number, lastError: (r.last_error as string | null) ?? null, at: new Date((r.posted_at ?? r.tried_at ?? r.created_at) as string), slug: c.slug, brand: c.brand_name, number: e.number }];
  });
}
