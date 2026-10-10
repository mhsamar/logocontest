import { after, NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { checkView } from "@/lib/logo-check/queries";
import { runLogoCheck } from "@/lib/logo-check/run";

export const maxDuration = 300;

/**
 * A check's status and, when it is done, the full result. The pop-up asks every 2 seconds. If the runner
 * stopped (the server was restarted mid-check), this starts it again from where it was.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/logo-checks/[id]">) {
  const { id } = await params;
  const view = await checkView(id, await getCurrentUser());
  if (!view) return NextResponse.json({ ok: false }, { status: 404 });
  if (view.stale) {
    const origin = req.nextUrl.origin;
    after(() => runLogoCheck(view.id, origin));
  }
  return NextResponse.json({ ok: true, check: view }, { headers: { "Cache-Control": "no-store" } });
}
