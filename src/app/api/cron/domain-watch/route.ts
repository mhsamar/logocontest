import { NextResponse, type NextRequest } from "next/server";
import { runDomainWatch } from "@/lib/domain/watch";

// The 5-minute .bd watch (owner, 2026-10-21), called by pg_cron on the Vercel address with
// "Authorization: Bearer <CRON_SECRET>". Only the live site writes the state and sends alerts; anywhere else it is a
// dry run that just reports (local, preview and live share one database), and only a dry run may watch another name.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const allowed = secret ? auth === `Bearer ${secret}` : process.env.NODE_ENV !== "production";
  if (!allowed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const dryRun = process.env.VERCEL_ENV !== "production";
  const name = dryRun ? req.nextUrl.searchParams.get("name")?.trim().toLowerCase() || undefined : undefined;
  try {
    return NextResponse.json(await runDomainWatch({ dryRun, name: name && /^[a-z0-9.-]+\.bd$/.test(name) ? name : undefined }));
  } catch (err) {
    console.error("[bd-watch]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
