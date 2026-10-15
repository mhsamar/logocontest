import "server-only";
import { randomBytes } from "node:crypto";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import { isSupabaseConfigured } from "@/lib/env";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { formatTaka } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { avatarUrl } from "@/lib/profile/avatar";
import { renderPng } from "@/lib/render/chrome";
import { getSetting } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_SIZES, escapeHtml, winCardHtml, type CardSize } from "./card-html";
import { COUNTED_WIN_STATUSES } from "./race-rules";
import { monthKey, monthRange } from "./rules";

/**
 * Contest win cards (owner, 2026-10-11; Design/rewards/designer-win-card.html, BLUEPRINT §11). Made when the client
 * (or an admin) picks the winner: an in-app notice and an email to the designer, the card on the dashboard, and a
 * public page /wins/<slug>. Always made; for blind, private and NDA contests the logo is blurred and the brand is
 * not named. The two pictures are drawn the first time they are asked for (/api/cards/win/<slug>/<size>) and kept.
 */

export const REWARD_CARDS_BUCKET = "reward-cards";

/** Public link of a stored card picture. */
export function cardPictureUrl(path: string): string {
  return `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/${REWARD_CARDS_BUCKET}/${path}`;
}

/** Where a card picture can be loaded: the stored file, or the route that draws it the first time. */
export const winCardImage = (slug: string, size: CardSize, path: string | null) => (path ? cardPictureUrl(path) : `/api/cards/win/${slug}/${size}`);

export type WinCard = {
  id: string;
  slug: string;
  hiddenLogo: boolean;
  createdAt: Date;
  squarePath: string | null;
  storyPath: string | null;
  entryId: string;
  contest: { id: string; slug: string; brand: string; prize: number; isPublic: boolean };
  entryNumber: number;
  designer: { id: string; name: string; username: string | null; avatarUrl: string | null; locale: "en" | "bn"; email: string | null };
};

const SELECT =
  "id, slug, hidden_logo, created_at, square_path, story_path, entry_id, contest:contests!contest_id(id, slug, brand_name, prize_amount, is_private, is_nda, is_blind, winner_is_public, status), entry:entries!entry_id(number), designer:profiles!designer_id(id, name, username, avatar_path, locale, email)";

type Raw = Record<string, unknown>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function toCard(r: Raw): WinCard | null {
  const c = one(r.contest as Raw | Raw[] | null);
  const d = one(r.designer as Raw | Raw[] | null);
  if (!c || !d) return null;
  return {
    id: r.id as string,
    slug: r.slug as string,
    hiddenLogo: Boolean(r.hidden_logo),
    createdAt: new Date(r.created_at as string),
    squarePath: (r.square_path as string | null) ?? null,
    storyPath: (r.story_path as string | null) ?? null,
    entryId: r.entry_id as string,
    contest: {
      id: c.id as string,
      slug: c.slug as string,
      brand: c.brand_name as string,
      prize: c.prize_amount as number,
      // The contest page is linked only when anyone may see it.
      isPublic: !c.is_private && !c.is_nda && !(c.is_blind && !c.winner_is_public),
    },
    entryNumber: (one(r.entry as Raw | Raw[] | null)?.number as number) ?? 0,
    designer: {
      id: d.id as string,
      name: ((d.name as string) || "").trim() || (d.username ? `@${d.username as string}` : "—"),
      username: (d.username as string | null) ?? null,
      avatarUrl: avatarUrl(d.avatar_path as string | null),
      locale: d.locale === "bn" ? "bn" : "en",
      email: (d.email as string | null) ?? null,
    },
  };
}

export async function winCardBySlug(slug: string): Promise<WinCard | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{6,80}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("win_cards").select(SELECT).eq("slug", slug).maybeSingle();
  return data ? toCard(data as Raw) : null;
}

/** A designer's win cards, newest first. */
export async function designerWinCards(designerId: string, limit = 12): Promise<WinCard[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("win_cards").select(SELECT).eq("designer_id", designerId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => toCard(r as Raw)).filter((c): c is WinCard => Boolean(c));
}

/** How many contests the designer has won this month (Asia/Dhaka), for the card page. */
export async function winsThisMonth(designerId: string, now = new Date()): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { start, end } = monthRange(monthKey(now));
  const { count } = await createAdminClient()
    .from("handovers")
    .select("id", { count: "exact", head: true })
    .eq("designer_id", designerId)
    .in("status", COUNTED_WIN_STATUSES)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());
  return count ?? 0;
}

/**
 * Makes the win card for a contest's winner (once; picking again returns the same card) and tells the designer in
 * the app and by email. Returns the card's slug, or null when win cards are switched off. Never throws.
 */
export async function createWinCard(contestId: string, entryId: string, origin: string): Promise<string | null> {
  try {
    if (!isSupabaseConfigured() || !(await getSetting("rewards.win_card_on"))) return null;
    const db = createAdminClient();
    const { data: c } = await db.from("contests").select("id, brand_name, is_blind, is_private, is_nda").eq("id", contestId).maybeSingle();
    const { data: e } = await db.from("entries").select("id, designer_id").eq("id", entryId).eq("contest_id", contestId).maybeSingle();
    if (!c || !e) return null;
    const hidden = Boolean(c.is_blind || c.is_private || c.is_nda);
    const { data: existing } = await db.from("win_cards").select("slug").eq("contest_id", contestId).maybeSingle();
    if (existing) return existing.slug as string;
    const slug = `win-${randomBytes(6).toString("hex")}`;
    const { error } = await db.from("win_cards").insert({ contest_id: contestId, entry_id: entryId, designer_id: e.designer_id, slug, hidden_logo: hidden });
    if (error) {
      // Another request made it first (one card per contest).
      const { data: again } = await db.from("win_cards").select("slug").eq("contest_id", contestId).maybeSingle();
      return (again?.slug as string | undefined) ?? null;
    }
    const link = `/dashboard/wins/${slug}`;
    await notify([e.designer_id as string], "win_card_ready", { brand: hidden ? undefined : (c.brand_name as string) }, link);
    // The email, in the designer's language.
    const { data: d } = await db.from("profiles").select("name, email, locale").eq("id", e.designer_id).maybeSingle();
    if (d?.email) {
      const t = await translatorFor(d.locale === "bn" ? "bn" : "en");
      await emailText({ userId: e.designer_id as string, email: d.email as string, locale: d.locale === "bn" ? "bn" : "en", subject: t("winCard.email.subject"), body: t(hidden ? "winCard.email.bodyHidden" : "winCard.email.body", { name: (d.name as string) || "", brand: c.brand_name as string, link: `${origin}${link}` }), notice: "win_card_ready" });
    }
    return slug;
  } catch (err) {
    console.error("[win-card] not made:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Draws one card picture and keeps it; returns the PNG. */
export async function renderWinCard(card: WinCard, size: CardSize, origin: string): Promise<Uint8Array> {
  const t = await translatorFor(card.designer.locale);
  const db = createAdminClient();
  // The winning design's first mockup, through a short-lived link.
  const { data: img } = await db.from("entry_images").select("preview_path").eq("entry_id", card.entryId).order("position").limit(1).maybeSingle();
  const logoUrl = img?.preview_path ? ((await getFileStorage().createReadUrls(ENTRY_FILES_BUCKET, [img.preview_path as string], 600).catch(() => new Map())).get(img.preview_path as string) ?? null) : null;
  const html = winCardHtml({
    size,
    origin,
    lang: card.designer.locale,
    badge: t("winCard.card.badge"),
    kicker: t("winCard.card.kicker"),
    name: card.designer.name,
    // The text is escaped first; only the brand is put back in bold.
    lineHtml: card.hiddenLogo
      ? escapeHtml(t("winCard.card.lineHidden"))
      : escapeHtml(t("winCard.card.line", { brand: "\u0000" })).replace("\u0000", `<strong>${escapeHtml(card.contest.brand)}</strong>`),
    footer: t("winCard.card.footer"),
    photoUrl: card.designer.avatarUrl,
    logo: { url: logoUrl, hidden: card.hiddenLogo, hiddenLabel: t("winCard.card.hidden") },
  });
  const png = await renderPng(html, CARD_SIZES[size]);
  const path = `win/${card.id}-${size}.png`;
  await getFileStorage().upload(REWARD_CARDS_BUCKET, path, png, "image/png");
  await db.from("win_cards").update(size === "square" ? { square_path: path } : { story_path: path }).eq("id", card.id);
  return png;
}

/** The prize as text, for the card page. */
export const prizeText = (card: WinCard, locale: "en" | "bn") => formatTaka(card.contest.prize, locale);
