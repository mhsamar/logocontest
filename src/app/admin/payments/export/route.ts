import { adminUser } from "@/lib/admin/core";
import { paymentsOverview } from "@/lib/admin/payments-overview";

/** "Download list" on Payments (design/admin/payments.html): every payment as a CSV file. Needs Payments → View. */
export async function GET() {
  if (!(await adminUser("payments.view"))) return new Response("Not found", { status: 404 });
  const rows = await paymentsOverview();
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote every cell; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const day = (d: Date | null) => (d ? d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "");
  const lines = [
    ["Created", "Paid", "Contest", "Brand", "Client", "For", "Method", "Gateway", "Transaction ID", "Amount", "Status"].map(cell).join(","),
    ...rows.map((p) =>
      [day(p.createdAt), day(p.paidAt), p.contest?.number ? `LC-${String(p.contest.number).padStart(4, "0")}` : "", p.contest?.brand, p.client?.name, p.purpose, p.method, p.gateway, p.txnId, p.amount, p.status].map(cell).join(","),
    ),
  ];
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
