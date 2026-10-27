import "server-only";
import { translatorFor } from "@/lib/content/texts";
import { formatTaka } from "@/lib/money";
import { avatarUrl } from "@/lib/profile/avatar";
import { CARD_SIZES, escapeHtml, payoutCardHtml, type CardSize } from "@/lib/rewards/card-html";
import { renderPng } from "@/lib/render/chrome";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The "Payment sent" card (owner, 2026-10-12) for one paid withdrawal. Drawn when asked for and never stored in a
 * public place: the amount is the designer's own business. Only that designer (or an admin) gets it.
 */
export async function renderPayoutCard(withdrawalId: string, viewer: { id: string; role: string }, size: CardSize, origin: string): Promise<Uint8Array | null> {
  if (!/^[0-9a-f-]{36}$/i.test(withdrawalId)) return null;
  const { data } = await createAdminClient()
    .from("withdrawals")
    .select("id, amount, method_type, status, designer:profiles!designer_id(id, name, username, avatar_path, locale)")
    .eq("id", withdrawalId)
    .maybeSingle();
  const d = data && ((Array.isArray(data.designer) ? data.designer[0] : data.designer) as { id: string; name: string | null; username: string | null; avatar_path: string | null; locale: string | null } | null);
  if (!data || !d || data.status !== "paid" || (viewer.id !== d.id && viewer.role !== "admin")) return null;
  const lang = d.locale === "bn" ? "bn" : "en";
  const t = await translatorFor(lang);
  const amount = formatTaka(data.amount as number, lang);
  const html = payoutCardHtml({
    size,
    origin,
    lang,
    pill: t("payoutCard.pill"),
    kicker: t("payoutCard.kicker"),
    name: (d.name ?? "").trim() || (d.username ? `@${d.username}` : "—"),
    lineHtml: escapeHtml(t(data.method_type === "bank" ? "payoutCard.lineBank" : "payoutCard.line", { amount: "\u0000" })).replace("\u0000", `<strong>${escapeHtml(amount)}</strong>`),
    amount,
    footer: t("payoutCard.footer"),
    photoUrl: avatarUrl(d.avatar_path, { full: true }),
  });
  return renderPng(html, CARD_SIZES[size]);
}
