import { NextResponse } from "next/server";
import { adminUser, audit } from "@/lib/admin/core";
import { adminUsersAll } from "@/lib/admin/users";
import { csvCell, parseUsersQuery } from "@/lib/admin/users-query";

/**
 * Admin → Users "Export CSV" (owner, 2026-10-12): the filtered list for admins with Users · manage, written to the
 * audit log. Never passwords, tokens, ID numbers or IP addresses.
 */
export async function GET(req: Request) {
  const admin = await adminUser("users.manage");
  if (!admin) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const q = parseUsersQuery(Object.fromEntries(url.searchParams));
  const { list, spent } = await adminUsersAll(q);
  const header = ["name", "username", "role", "status", "mobile", "email", "email_verified", "suspensions_30_days", "wins", "spent_taka", "joined", "last_active"];
  const lines = [header.map(csvCell).join(",")];
  for (const u of list) {
    lines.push(
      [
        u.name,
        u.username ?? "",
        u.role,
        u.status,
        u.mobile,
        u.email ?? "",
        u.email_verified_at ? "yes" : "no",
        u.strikes ?? 0,
        u.role === "designer" ? (u.counted_wins_count ?? 0) : "",
        u.role === "client" ? (spent.get(u.id) ?? 0) : "",
        u.created_at.slice(0, 10),
        u.last_seen_at ? u.last_seen_at.slice(0, 16).replace("T", " ") : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await audit(admin.id, "export_users", "users", null, { rows: list.length, filters: Object.fromEntries(url.searchParams) });
  const day = new Date().toISOString().slice(0, 10);
  // A byte-order mark so Excel reads Bangla names correctly.
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="logocontest-users-${day}.csv"`, "Cache-Control": "no-store" },
  });
}
