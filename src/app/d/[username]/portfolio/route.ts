import { portfolioPdf } from "@/lib/designers/portfolio-pdf";
import { designerByUsername, publicDesigns } from "@/lib/designers/profile";
import { printedOrigin } from "@/lib/site-hosts";
import { requestOrigin } from "@/lib/site-origin";

/** The designer's portfolio as a downloadable PDF (P-06, owner 2026-10-08). */
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const designer = await designerByUsername(username);
  if (!designer) return new Response("Not found", { status: 404 });
  // The printed link is always the main address (owner, 2026-10-21).
  const designs = await publicDesigns(designer.id);
  const pdf = await portfolioPdf(designer, designs, `${printedOrigin(await requestOrigin())}/d/${designer.username}`);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="logocontest-${designer.username}-portfolio.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
