import { NextResponse, type NextRequest } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { promoCsv } from "@/lib/payments/admin-queries";

/** Admin › Payments › Promo codes › Download CSV: one batch of one-time codes (or one shared code). */
export async function GET(req: NextRequest) {
  const admin = await adminUser("payments.view");
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!admin || !/^[0-9a-f-]{36}$/i.test(key)) return new NextResponse("Not found", { status: 404 });
  const file = await promoCsv(key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(`﻿${file.csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file.name}"`, "Cache-Control": "no-store" },
  });
}
