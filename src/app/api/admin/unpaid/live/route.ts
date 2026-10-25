import { NextResponse, type NextRequest } from "next/server";
import { adminUser, UUID } from "@/lib/admin/core";
import { helpThread, liveCards, watchCard } from "@/lib/admin/unpaid-live";

/**
 * Admin › Unpaid contests, "Creating a contest right now" (owner, 2026-10-25): the live cards every few seconds, with
 * ?watch=<visit> one person's form answers (Watch, logged here), or with ?thread=<visit> their help chat. Unpaid
 * contests · view. A plain GET, not a server action, so the polling never waits in line with the admin's own clicks.
 */
export async function GET(req: NextRequest) {
  const user = await adminUser("unpaid.view");
  if (!user) return NextResponse.json(null, { status: 401 });
  const headers = { "Cache-Control": "no-store" };
  const watch = req.nextUrl.searchParams.get("watch");
  if (watch !== null) {
    if (!UUID.test(watch)) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({ card: await watchCard(user, watch.toLowerCase()) }, { headers });
  }
  const thread = req.nextUrl.searchParams.get("thread");
  if (thread !== null) {
    if (!UUID.test(thread)) return NextResponse.json(null, { status: 404 });
    return NextResponse.json({ thread: await helpThread(user, thread.toLowerCase()) }, { headers });
  }
  return NextResponse.json(await liveCards(user), { headers });
}
