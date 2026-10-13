import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { hasPermission } from "@/lib/admin/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { receiptCode } from "@/lib/pro/rules";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A Pro receipt as a PDF (owner, 2026-10-13: Wallet › Pro receipts). Only the designer who paid, or an admin with the
 * Pro plan permission. Plain English with "BDT" (the PDF's built-in fonts have no taka sign).
 */
export async function GET(_req: NextRequest, { params }: RouteContext<"/api/pro/receipt/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data: p } = await createAdminClient().from("pro_payments").select("id, designer_id, amount_bdt, receipt_no, status, method, paid_at, kind, provider_ref").eq("id", id).maybeSingle();
  if (!p || p.status !== "paid" || (p.designer_id !== user.id && !hasPermission(user, "pro.view"))) return new NextResponse("Not found", { status: 404 });
  const { data: who } = await createAdminClient().from("profiles").select("name, email").eq("id", p.designer_id).maybeSingle();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const maroon = rgb(0.545, 0, 0);
  const grey = rgb(0.37, 0.38, 0.42);
  const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, "?");
  page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: maroon });
  page.drawText("logocontest.bd", { x: 48, y: 795, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Pro receipt", { x: 420, y: 795, size: 16, font: bold, color: rgb(1, 0.9, 0.6) });
  const rows: [string, string][] = [
    ["Receipt", receiptCode(p.receipt_no as number)],
    ["Date", new Date(p.paid_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" })],
    ["Paid by", ascii(((who?.name as string) ?? "").trim() || "-")],
    ["Email", ascii((who?.email as string) ?? "-")],
    ["Plan", `logocontest.bd Pro - 1 month (${p.kind === "renewal" ? "renewal" : "new"})`],
    ["Paid with", p.method === "card" ? "Card" : "bKash"],
    ["Payment reference", ascii((p.provider_ref as string | null) ?? "-")],
    ["Amount", `BDT ${(p.amount_bdt as number).toLocaleString("en-US")}`],
  ];
  let y = 700;
  for (const [k, v] of rows) {
    page.drawText(k, { x: 48, y, size: 12, font, color: grey });
    page.drawText(v, { x: 220, y, size: 13, font: k === "Amount" ? bold : font, color: k === "Amount" ? maroon : rgb(0.07, 0.07, 0.09) });
    y -= 30;
  }
  page.drawLine({ start: { x: 48, y: y + 12 }, end: { x: 547, y: y + 12 }, thickness: 1, color: rgb(0.9, 0.9, 0.92) });
  page.drawText("Thank you for going Pro. Cancel anytime from Settings > Subscription.", { x: 48, y: y - 14, size: 11, font, color: grey });
  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${receiptCode(p.receipt_no as number)}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
