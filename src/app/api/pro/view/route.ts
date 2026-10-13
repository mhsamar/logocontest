import { NextResponse, type NextRequest } from "next/server";
import { isBot, isUuid, VISITOR_COOKIE } from "@/lib/analytics/rules";
import { getCurrentUser } from "@/lib/auth/session";
import { getProSettings } from "@/lib/pro/settings";
import { createAdminClient } from "@/lib/supabase/admin";

const SOURCES = ["contest", "browse", "studio", "leaderboard", "profile", "other"];
// One view per visitor and design every 30 minutes (per server), so refreshing doesn't inflate the numbers.
const recent = new Map<string, number>();

/** POST { entryId, source }: one design view for Pro insights. The designer's own views don't count. Never fails loudly. */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  if (isBot(req.headers.get("user-agent") ?? "")) return done;
  const { ready } = await getProSettings();
  if (!ready) return done;
  let body: { entryId?: unknown; source?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return done;
  }
  if (!isUuid(body.entryId)) return done;
  const source = typeof body.source === "string" && SOURCES.includes(body.source) ? body.source : "other";
  const user = await getCurrentUser();
  const visitor = req.cookies.get(VISITOR_COOKIE)?.value ?? "";
  const key = `${user?.id ?? visitor}:${body.entryId}`;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 30 * 60_000) return done;
  recent.set(key, now);
  if (recent.size > 20000) recent.clear();
  const db = createAdminClient();
  const { data: e } = await db.from("entries").select("id, designer_id, contest:contests!contest_id(client_id)").eq("id", body.entryId).maybeSingle();
  if (!e || e.designer_id === user?.id) return done;
  const c = (Array.isArray(e.contest) ? e.contest[0] : e.contest) as { client_id: string } | null;
  await db.from("entry_views").insert({ entry_id: e.id, designer_id: e.designer_id, viewer_id: user?.id ?? null, by_client: Boolean(user && c && c.client_id === user.id), source });
  return done;
}
