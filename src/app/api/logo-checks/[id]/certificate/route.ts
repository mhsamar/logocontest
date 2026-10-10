import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { certNumber } from "@/lib/logo-check/rules";
import { checkView } from "@/lib/logo-check/queries";
import { LOGO_CHECKS_BUCKET, makeCertificate } from "@/lib/logo-check/run";
import { createAdminClient } from "@/lib/supabase/admin";

// Rendering with headless Chrome can take a while the first time.
export const maxDuration = 120;

/** Downloads the Logo Research Certificate as PDF (default) or PNG; made now if it doesn't exist yet. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/logo-checks/[id]/certificate">) {
  const { id } = await params;
  const view = await checkView(id, await getCurrentUser());
  if (!view || view.status !== "done") return NextResponse.json({ ok: false }, { status: 404 });
  const png = req.nextUrl.searchParams.get("format") === "png";
  let path = `${view.id}/certificate.${png ? "png" : "pdf"}`;
  if (!(png ? view.certificate.png : view.certificate.pdf)) {
    try {
      const made = await makeCertificate(view.id, req.nextUrl.origin);
      path = png ? made.png : made.pdf;
    } catch (e) {
      console.error("[logo-check] certificate:", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, error: "certificate" }, { status: 500 });
    }
  }
  const name = `${certNumber(view.number)}-logo-research-certificate.${png ? "png" : "pdf"}`;
  const { data } = await createAdminClient().storage.from(LOGO_CHECKS_BUCKET).createSignedUrl(path, 300, { download: name });
  if (!data?.signedUrl) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
