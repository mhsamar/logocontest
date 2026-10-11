import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import { monthLabel } from "@/lib/notifications/render";
import { renderPng } from "@/lib/render/chrome";
import { CARD_SIZES, monthlyCardHtml } from "@/lib/rewards/card-html";
import { monthRace } from "@/lib/rewards/race";
import { isMonthKey, monthKey } from "@/lib/rewards/rules";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Admin → Monthly winner, "Preview the cards" (owner, 2026-10-11): the smartphone or gift box card as it would look
 * for whoever leads the month right now. Drawn on request, never kept; admins only.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/preview/[kind]">) {
  const { kind } = await ctx.params;
  if (kind !== "smartphone" && kind !== "gift_box") return new NextResponse("Not found", { status: 404 });
  if (!(await adminUser("monthly.view"))) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const m = url.searchParams.get("month") ?? "";
  const month = isMonthKey(m) ? m : monthKey(new Date());
  const race = await monthRace(month, { testMode: url.searchParams.get("test") === "1" });
  const leader = kind === "smartphone" ? race.clients[0] : race.designers[0];
  if (!leader) return new NextResponse("Nobody yet", { status: 404 });
  try {
    // In the admin's language; the real card uses the winner's.
    const { t, locale } = await getI18n();
    const html = monthlyCardHtml({
      size: "square",
      origin: process.env.SITE_URL?.replace(/\/$/, "") || url.origin,
      lang: locale,
      kind,
      month: monthLabel(month, locale),
      kicker: t("monthlyReward.card.kicker"),
      name: leader.profile.name,
      line: t(`monthlyReward.card.${kind}.line`),
      footer: t(`monthlyReward.card.${kind}.footer`),
      photoUrl: leader.profile.avatarUrl,
    });
    const png = await renderPng(html, CARD_SIZES.square);
    return new NextResponse(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[card-preview]", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
