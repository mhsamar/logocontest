import { NextResponse, type NextRequest } from "next/server";
import { isBot, isUuid } from "@/lib/analytics/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPopupEvent } from "@/lib/visitor-popup/rules";

// At most 20 events a minute from one pop-up visitor id on one server.
const recent = new Map<string, number[]>();
function tooMany(id: string): boolean {
  const now = Date.now();
  const hits = (recent.get(id) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(id, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > 20;
}

/**
 * Visitor pop-up events (owner, 2026-10-13): the event name, an anonymous random id made in the browser, and the
 * time. No name, email, IP or user id is stored. Never fails loudly.
 */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  if (!isSupabaseConfigured()) return done;
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || isBot(ua)) return done;
  let body: { event?: unknown; vid?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return done;
  }
  if (!isPopupEvent(body.event) || !isUuid(body.vid)) return done;
  if (tooMany(body.vid)) return done;
  const { error } = await createAdminClient().from("popup_events").insert({ visitor_id: body.vid, event: body.event });
  if (error) console.warn("[popup] event not saved:", error.message);
  return done;
}
