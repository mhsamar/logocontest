import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { proActivityExport } from "@/lib/pro/admin-queries";

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

/** Admin › Pro plan › Activity log › Export: every change as a CSV file. Pro plan permission only. */
export async function GET() {
  const admin = await adminUser("pro.view");
  if (!admin) return new NextResponse("Not found", { status: 404 });
  const rows = await proActivityExport();
  const csv = ["when,who,action,designer,old,new", ...rows.map((r) => [r.at, r.actor, r.action, r.designer, r.old, r.new].map(cell).join(","))].join("\n");
  return new NextResponse(`﻿${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="pro-activity-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
