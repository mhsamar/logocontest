import { adminUser } from "@/lib/admin/core";
import { payoutRows } from "@/lib/admin/payouts";

/** "Download list" on Withdrawals (owner, 2026-10-16): every payout to designers as a CSV file. Needs Withdrawals → View. */
export async function GET() {
  if (!(await adminUser("withdrawals.view"))) return new Response("Not found", { status: 404 });
  const rows = await payoutRows(5000);
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote every cell; a leading = + - @ is neutralised so spreadsheets don't run it as a formula.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const day = (d: Date | null) => (d ? d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "");
  const to = (r: (typeof rows)[number]) =>
    r.methodType === "bkash"
      ? `bKash ${(r.full.bkash_number ?? "").replace(/^\+?880/, "0")}${r.full.bkash_kind ? ` (${r.full.bkash_kind})` : ""}`
      : [r.full.bank_name, r.full.branch, r.full.account_name, r.full.account_number, r.full.routing_number].filter(Boolean).join(" / ");
  const lines = [
    ["Requested", "Paid or rejected", "Designer", "Username", "Amount", "Status", "Sent to", "Transaction ID", "How", "By", "Reject reason"].map(cell).join(","),
    ...rows.map((r) => [day(r.createdAt), day(r.processedAt), r.designer.name, r.designer.username, r.amount, r.status, to(r), r.txnId, r.gateway, r.processedBy, r.rejectReason].map(cell).join(",")),
  ];
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="withdrawals-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
