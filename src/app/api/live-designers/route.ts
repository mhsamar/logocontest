import { NextResponse } from "next/server";
import { liveDesigners } from "@/lib/home/live-designers";

/** The live designers tag's numbers for the open home page (refreshed about once a minute). Nothing personal. */
export async function GET() {
  return NextResponse.json(await liveDesigners(), { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
}
