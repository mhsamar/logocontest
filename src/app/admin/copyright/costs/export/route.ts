import { NextResponse, type NextRequest } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { costCsv, costReport } from "@/lib/logo-check/cost-report";

/** Admin › Copyright checker › Cost report › Download: the month's checks and their API cost as a CSV file. */
export async function GET(req: NextRequest) {
  const admin = await adminUser("copyright.view");
  if (!admin) return new NextResponse("Not found", { status: 404 });
  const report = await costReport(req.nextUrl.searchParams.get("month"));
  return new NextResponse(`﻿${costCsv(report)}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="logo-checker-costs-${report.month.key}.csv"`, "Cache-Control": "no-store" },
  });
}
