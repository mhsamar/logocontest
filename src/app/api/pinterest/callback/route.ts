import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminUser, audit } from "@/lib/admin/core";
import { accountOf, exchangeCode, pinterestConfigured } from "@/lib/pinterest/api";
import { CALLBACK_PATH } from "@/lib/pinterest/rules";
import { saveTokens } from "@/lib/pinterest/store";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Pinterest sends the admin back here (owner, 2026-10-19). The state must match the one we set; then the tokens are saved, sealed. */
export async function GET(req: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/admin/pinterest?${q}`, siteUrl()));
    res.cookies.set("lc_pin_state", "", { path: "/api/pinterest", maxAge: 0 });
    return res;
  };
  const admin = await adminUser("autoshare.manage");
  if (!admin) return new NextResponse("Not found", { status: 404 });
  if (!pinterestConfigured()) return back("error=keys");
  const sp = req.nextUrl.searchParams;
  const state = sp.get("state") ?? "";
  const saved = req.cookies.get("lc_pin_state")?.value ?? "";
  if (!state || !saved || !same(state, saved)) return back("error=state");
  if (sp.get("error") || !sp.get("code")) return back("error=denied");
  try {
    const now = new Date();
    const tokens = await exchangeCode(sp.get("code")!, `${siteUrl()}${CALLBACK_PATH}`);
    const account = await accountOf(tokens.access_token).catch(() => ({ username: undefined }));
    await saveTokens(tokens, now, { username: account.username ?? null, by: admin.id });
    await audit(admin.id, "pinterest_connect", "settings", "pinterest", { username: account.username ?? null });
    return back("connected=1");
  } catch (e) {
    console.error("[pinterest] connect:", e instanceof Error ? e.message : e);
    return back("error=connect");
  }
}
