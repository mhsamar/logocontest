import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { reportById } from "@/lib/logo-check/entry-check";
import { reportPdf } from "@/lib/logo-check/report-pdf";

// Rendering with headless Chrome can take a while the first time.
export const maxDuration = 120;

/** The originality report as a PDF: the entry's designer, the contest's client and admins (owner, 2026-10-14). */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/entries/report/[reportId]">) {
  const { reportId } = await params;
  const report = await reportById(reportId, await getCurrentUser());
  if (!report) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const pdf = await reportPdf(report, req.nextUrl.origin);
    return new NextResponse(Buffer.from(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${report.reportId}-originality-report.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    console.error("[logo-check] report pdf:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "pdf" }, { status: 500 });
  }
}
