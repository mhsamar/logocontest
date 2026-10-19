import { NextResponse, type NextRequest } from "next/server";
import { runLifecycle } from "@/lib/lifecycle/run";
import { runContestCards } from "@/lib/cards/job";
import { runPinterest } from "@/lib/pinterest/job";

// The 15-minute lifecycle job (BLUEPRINT §6). Call with "Authorization: Bearer <CRON_SECRET>".
// In development it also runs without a secret when CRON_SECRET isn't set, so it can be tried locally.
export const dynamic = "force-dynamic";
// Drawing contest cards (headless Chrome) takes a few seconds each.
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const allowed = secret ? auth === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!allowed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await runLifecycle();
  if (report.errors.length) console.error("[lifecycle]", report.errors);
  // Pinterest auto-posting (owner, 2026-10-19): its own step after the contest timers, so a Pinterest problem never
  // holds them up. It does nothing until Admin › Pinterest is connected and switched on.
  const pinterest = await runPinterest().catch((e) => ({ status: "error", error: e instanceof Error ? e.message : String(e) }));
  if ("errors" in pinterest && pinterest.errors.length) console.error("[pinterest]", pinterest.errors);
  // Contest cards (owner, 2026-10-19): new live contests get their Facebook card. Also after the timers, on its own.
  const cards = await runContestCards().catch((e) => ({ status: "error", error: e instanceof Error ? e.message : String(e) }));
  if ("errors" in cards && cards.errors.length) console.error("[cards]", cards.errors);
  return NextResponse.json({ ...report, pinterest, cards });
}

export const GET = handle;
export const POST = handle;
