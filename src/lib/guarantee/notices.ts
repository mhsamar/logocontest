import "server-only";
import { adminIdsWith } from "@/lib/admin/recipients";
import { contestHref } from "@/lib/client/rules";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import { notify } from "@/lib/notifications";
import { linkOrigin } from "@/lib/site-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundAmountText, type RouteAmount } from "./rules";

/**
 * Money-back guarantee notices (owner, 2026-10-21): the client hears in the app and by email in their own language;
 * the team with Money-back claims hears when a claim arrives or waits too long.
 */

export type ClientNotice = "available" | "claimed" | "approved" | "rejected" | "refunded";

const TYPE = { available: "guarantee_available", claimed: "guarantee_claimed", approved: "guarantee_approved", rejected: "guarantee_rejected", refunded: "guarantee_refunded" } as const;

export async function tellClient(
  kind: ClientNotice,
  c: { clientId: string; slug: string; brand: string },
  p: { min?: number; designers?: number; days?: number; until?: Date | null; routes?: RouteAmount[]; amount?: number; reason?: string; ref?: string; late?: boolean } = {},
): Promise<void> {
  const link = contestHref(c.slug, "payment");
  await notify([c.clientId], TYPE[kind], { brand: c.brand, number: p.min, days: p.days, reason: p.reason }, link);
  const { data: who } = await createAdminClient().from("profiles").select("email, locale").eq("id", c.clientId).maybeSingle();
  if (!who?.email) return;
  const locale = who.locale === "bn" ? "bn" : "en";
  const t = await translatorFor(locale);
  const date = p.until ? p.until.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "";
  const params = {
    brand: c.brand,
    n: p.min ?? "",
    count: p.designers ?? "",
    date,
    amount: refundAmountText(p.routes ?? [], locale, p.amount ?? 0),
    reason: p.reason ?? "",
    ref: p.ref ?? "",
    link: `${await linkOrigin()}${link}`,
  };
  // Late claims (no-result end) and contests where no designer counts: nothing to pick, so no "pick a winner" lines.
  const claimOnly = p.late || p.designers === 0;
  const body =
    kind === "rejected" && p.late ? "guarantee.email.rejectedLate.body" : kind === "claimed" && p.late ? "guarantee.email.claimedLate.body" : kind === "available" && claimOnly ? "guarantee.email.availableClaimOnly.body" : `guarantee.email.${kind}.body`;
  await emailText({ notice: "guarantee", userId: c.clientId, email: who.email as string, locale, subject: t(`guarantee.email.${kind}.subject`, params), body: t(body as `guarantee.email.${ClientNotice}.body`, params) });
}

/** The team with Money-back claims: a new claim, or one that waits too long. In the app, and a short email. */
export async function tellTeam(kind: "claimed" | "overdue", brand: string): Promise<void> {
  const ids = await adminIdsWith("refunds.view");
  await notify(ids, kind === "claimed" ? "guarantee_claimed_admin" : "guarantee_overdue_admin", { brand }, "/admin/refunds");
  if (!ids.length) return;
  const { data } = await createAdminClient().from("profiles").select("id, email, locale").in("id", ids);
  const link = `${await linkOrigin()}/admin/refunds`;
  for (const a of data ?? []) {
    if (!a.email) continue;
    const locale = a.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(locale);
    await emailText({ notice: "admin_refunds", userId: a.id as string, email: a.email as string, locale, subject: t(`guarantee.email.team.${kind}.subject`, { brand }), body: t(`guarantee.email.team.${kind}.body`, { brand, link }) });
  }
}
