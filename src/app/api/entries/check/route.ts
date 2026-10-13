import { after, NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { entryCheckState, startEntryCheck } from "@/lib/logo-check/entry-check";
import { runLogoCheck } from "@/lib/logo-check/run";

// The check runs after the answer is sent (never inside the request); up to 5 minutes.
export const maxDuration = 300;

/**
 * Logo check inside contests (owner, 2026-10-14). POST starts a designer's check of the design they just
 * uploaded (form fields contestId, requestKey, path); the server makes the fingerprint and the score. GET ?id=
 * follows it: status, then score, level, closest results and the report ID, and the checks left this month.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return NextResponse.json({ ok: false, error: "invalid" }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const res = await startEntryCheck(user, { contestId: String(form.get("contestId") ?? ""), requestKey: String(form.get("requestKey") ?? ""), path: String(form.get("path") ?? "") });
  if (!res.ok) return NextResponse.json(res, { status: 400 });
  const origin = req.nextUrl.origin;
  after(() => runLogoCheck(res.id, origin));
  return NextResponse.json(res);
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const state = user ? await entryCheckState(id, user) : null;
  if (!state) return NextResponse.json({ ok: false }, { status: 404 });
  // The runner stopped (a server restart mid-check): start it again from where it was.
  if (state.stale) {
    const origin = req.nextUrl.origin;
    after(() => runLogoCheck(state.id, origin));
  }
  return NextResponse.json({ ok: true, check: state }, { headers: { "Cache-Control": "no-store" } });
}
