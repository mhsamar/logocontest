import { after, NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { runLogoCheck } from "@/lib/logo-check/run";
import { startCheck } from "@/lib/logo-check/start";

// The check runs after the answer is sent (owner, 2026-10-10: never inside the request); up to 5 minutes.
export const maxDuration = 300;

/** Starts an AI logo check: form fields contestId, requestKey, and entryId or file. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return NextResponse.json({ ok: false, error: "not_found" }, { status: 403 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "too_big" }, { status: 400 });
  }
  const file = form.get("file");
  const entryId = form.get("entryId");
  const res = await startCheck(user, {
    contestId: String(form.get("contestId") ?? ""),
    requestKey: String(form.get("requestKey") ?? ""),
    entryId: typeof entryId === "string" && entryId ? entryId : null,
    file: file instanceof File && file.size > 0 ? file : null,
  });
  if (!res.ok) return NextResponse.json(res, { status: 400 });
  const origin = req.nextUrl.origin;
  after(() => runLogoCheck(res.id, origin));
  return NextResponse.json(res);
}
