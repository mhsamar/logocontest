import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * The open admin tab checks in once a minute (owner, 2026-10-14): how many seconds since the admin last clicked, typed,
 * scrolled or touched, or that the tab is closing. Staff are signed out when idle too long or when every admin tab
 * was closed (security.admin_idle_minutes, security.admin_close_tab_signout).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ state: "none" });
  const body = (await req.json().catch(() => ({}))) as { idle?: unknown; bye?: unknown };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sessionId = data?.claims?.session_id as string | undefined;
  if (!sessionId) return NextResponse.json({ state: "none" });
  const idle = Math.max(0, Math.min(86_400, Math.floor(Number(body.idle) || 0)));
  const { data: state, error } = await supabase.rpc("session_heartbeat", { p_session: sessionId, p_idle_seconds: idle, p_bye: body.bye === true });
  if (error) return NextResponse.json({ state: "none" });
  if (typeof state === "string" && state.startsWith("ended")) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.json({ state });
}
