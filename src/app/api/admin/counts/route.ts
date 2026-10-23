import { NextResponse } from "next/server";
import { adminCounts } from "@/lib/admin/badges";
import { adminUser } from "@/lib/admin/core";

/**
 * The admin menu's red and gold counts (owner, 2026-10-23), fetched by the open admin tab once a minute. A plain GET,
 * not a server action, so it never waits in line with the admin's own clicks.
 */
export async function GET() {
  const user = await adminUser();
  if (!user) return NextResponse.json(null, { status: 401 });
  return NextResponse.json(await adminCounts(user), { headers: { "Cache-Control": "no-store" } });
}
