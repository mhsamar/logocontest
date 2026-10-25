import { NextResponse, type NextRequest } from "next/server";
import { runUnpaidAlerts } from "@/lib/admin/unpaid-alerts";

// Unpaid contests' instant alerts (owner, 2026-10-26): every 5 minutes, so "Follow-up is due" lands about 10 minutes
// before. Call with "Authorization: Bearer <CRON_SECRET>", like the lifecycle job. Light: no images, no Chrome.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const allowed = secret ? auth === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!allowed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runUnpaidAlerts());
  } catch (e) {
    console.error("[cron/alerts]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
