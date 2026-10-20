import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { pinterestAppId, pinterestConfigured } from "@/lib/pinterest/api";
import { authorizeUrl, CALLBACK_PATH } from "@/lib/pinterest/rules";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** "Connect Pinterest" (owner, 2026-10-19): off to Pinterest's own login and permission page, with a one-time state. */
export async function GET() {
  const admin = await adminUser("autoshare.manage");
  if (!admin) return new NextResponse("Not found", { status: 404 });
  if (!pinterestConfigured()) return NextResponse.redirect(new URL("/admin/pinterest?error=keys", siteUrl()));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl({ clientId: pinterestAppId(), redirectUri: `${siteUrl()}${CALLBACK_PATH}`, state }));
  res.cookies.set("lc_pin_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/pinterest", maxAge: 600 });
  return res;
}
