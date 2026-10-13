import { NextResponse, type NextRequest } from "next/server";
import { isBot, isUuid, VISITOR_COOKIE } from "@/lib/analytics/rules";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProSettings } from "@/lib/pro/settings";
import { logFunnel } from "@/lib/pro/subscription";

/** Funnel steps the browser reports (owner, 2026-10-13); the others are written by the server where they happen. */
const FROM_BROWSER = ["card_seen", "upgrade_clicked", "checkout_closed"] as const;
type BrowserEvent = (typeof FROM_BROWSER)[number];
const STEP = /^[a-z_]{1,30}$/;

/** POST { event, step? }. "Card seen" counts once per person a day. Never fails loudly. */
export async function POST(req: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  if (isBot(req.headers.get("user-agent") ?? "")) return done;
  const { ready } = await getProSettings();
  if (!ready) return done;
  let body: { event?: unknown; step?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return done;
  }
  const event = FROM_BROWSER.find((e) => e === body.event) as BrowserEvent | undefined;
  if (!event) return done;
  const step = typeof body.step === "string" && STEP.test(body.step) ? body.step : null;
  const user = await getCurrentUser();
  if (user && user.role !== "designer") return done;
  const visitor = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = isUuid(visitor) ? visitor : null;
  if (!user && !visitorId) return done;
  if (event === "card_seen") {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    let q = createAdminClient().from("pro_funnel_events").select("id", { count: "exact", head: true }).eq("event", "card_seen").gte("created_at", since);
    q = user ? q.eq("designer_id", user.id) : q.eq("visitor_id", visitorId!);
    const { count } = await q;
    if ((count ?? 0) > 0) return done;
  }
  await logFunnel(event, { designerId: user?.id ?? null, visitorId, step });
  return done;
}
