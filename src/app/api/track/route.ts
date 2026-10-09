import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { countryOf, deviceOf, isBot, isUuid, PAGE_VIEW_DAYS, referrerHost, trackablePath, VISITOR_COOKIE } from "@/lib/analytics/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A simple per-server guard so one visitor can't flood the table: at most 30 hits a minute.
const recent = new Map<string, number[]>();
function tooMany(visitorId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(visitorId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(visitorId, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 30;
}

/**
 * Visit tracking (BLUEPRINT §13.2 item 3): a page view records one row and refreshes the visitor's
 * "online now" row; a heartbeat only refreshes it. No IP address is stored. Never fails loudly.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  if (!isSupabaseConfigured()) return done;
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || isBot(ua)) return done;

  let body: { path?: unknown; referrer?: unknown; beat?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return done;
  }
  const path = trackablePath(body.path);
  if (!path) return done;

  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = isUuid(existing) ? existing : randomUUID();
  if (visitorId !== existing) done.cookies.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: PAGE_VIEW_DAYS * 86400 });

  if (tooMany(visitorId)) return done;
  const device = deviceOf(ua);
  const country = countryOf(req.headers.get("x-vercel-ip-country"));
  const db = createAdminClient();
  const now = new Date().toISOString();

  try {
    if (body.beat === true) {
      // Heartbeat: keep the person "online" on the page they are looking at.
      const { data } = await db.from("presence").update({ path, updated_at: now }).eq("visitor_id", visitorId).select("visitor_id");
      if (data?.length) return done;
    }
    // Page view: who it is (checked on the server), then one row plus the online row.
    const { data: auth } = await (await createClient()).auth.getUser();
    const userId = auth.user?.id ?? null;
    await Promise.all([
      body.beat === true ? null : db.from("page_views").insert({ visitor_id: visitorId, user_id: userId, path, referrer: referrerHost(body.referrer, req.nextUrl.hostname), device, country }),
      db.from("presence").upsert({ visitor_id: visitorId, user_id: userId, path, device, country, updated_at: now }, { onConflict: "visitor_id", ignoreDuplicates: false }),
    ]);
  } catch (e) {
    console.error("[track] failed:", e instanceof Error ? e.message : e);
  }
  return done;
}
