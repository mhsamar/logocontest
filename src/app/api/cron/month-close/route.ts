import { NextResponse, type NextRequest } from "next/server";
import { closeMonth } from "@/lib/rewards/month-close";
import { closableMonth } from "@/lib/rewards/race-rules";
import { linkOrigin } from "@/lib/site-origin";

// Picking the winners and sending can take a little while.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The month close (owner, 2026-10-11; REWARDS-HANDOFF §E). pg_cron calls it at 23:59 Asia/Dhaka on days 28–31 with
 * "Authorization: Bearer <CRON_SECRET>"; it closes the month only on its real last day, and only once. If this run is
 * missed, the 15-minute job closes the month on the 1st.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const allowed = secret ? auth === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!allowed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const month = closableMonth(new Date());
  if (!month) return NextResponse.json({ skipped: "not the end of the month" });
  try {
    // Winner emails follow Admin › Settings › Backup links (owner, 2026-10-21).
    const origin = process.env.SITE_URL ? await linkOrigin() : req.nextUrl.origin;
    return NextResponse.json(await closeMonth(month, { origin }));
  } catch (err) {
    console.error("[month-close]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
