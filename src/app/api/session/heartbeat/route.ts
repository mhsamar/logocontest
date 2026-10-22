import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { endReasonOf, sessionIdOfToken } from "@/lib/auth/sessions";
import { createClient } from "@/lib/supabase/server";

/**
 * The open admin tab checks in once a minute (owner, 2026-10-14): how many seconds since the admin last clicked, typed,
 * scrolled or touched, or that the tab is closing. Staff are signed out when idle too long or when every admin tab
 * was closed only while those are switched on (security.admin_idle_minutes above 0, security.admin_close_tab_signout;
 * both off since 2026-10-22).
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ state: "none" });
  const body = (await req.json().catch(() => ({}))) as { idle?: unknown; bye?: unknown };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sessionId = data?.claims?.session_id as string | undefined;
  // Already signed out (for example by a background request a moment ago): say why when we know.
  if (!sessionId) {
    const { data: stale } = await supabase.auth.getSession();
    const why = req.cookies.get("lc_ended")?.value ?? (await endReasonOf(sessionIdOfToken(stale.session?.access_token)).catch(() => null));
    if (stale.session) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return NextResponse.json({ state: why ? `ended:${why}` : "signed_out" });
  }
  const idle = Math.max(0, Math.min(86_400, Math.floor(Number(body.idle) || 0)));
  const { data: state, error } = await supabase.rpc("session_heartbeat", { p_session: sessionId, p_idle_seconds: idle, p_bye: body.bye === true });
  if (error) return NextResponse.json({ state: "none" });
  if (typeof state === "string" && state.startsWith("ended")) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return NextResponse.json({ state });
}
