import "server-only";
import { cache } from "react";
import sharp from "sharp";
import en from "@/lib/i18n/messages/en";
import { getService } from "@/lib/services/store";
import { isLogo } from "@/lib/services/types";
import { getSettings } from "@/lib/settings";
import { linkOrigin } from "@/lib/site-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderCard } from "./render";
import {
  banglaLine,
  cardBrand,
  CARD_SIZES,
  cleanHashtags,
  cleanText,
  contestCode,
  daysLeft,
  endDateText,
  fillCaption,
  prizeText,
  shortLinkPath,
  shortLinkText,
  type CardKind,
  type CardSizeKey,
  type CardStatus,
  type CardStyle,
} from "./rules";
import { CARD_TEMPLATE_VERSION, type CardData } from "./template";

/** Contest cards in the database and in Storage (owner, 2026-10-19; migration 0067). */

export const CARDS_BUCKET = "contest-cards";
const db = () => createAdminClient();
const missing = (m: string) => /does not exist|schema cache|Could not find/i.test(m);

/** What migration 0067 added, checked with real selects (a head-only count says nothing about a missing table). */
export const cardsReady = cache(async (): Promise<{ table: boolean; shareColumn: boolean }> => {
  const [t, c] = await Promise.all([db().from("contest_cards").select("id").limit(1), db().from("contests").select("share_on_facebook").limit(1)]);
  return { table: !t.error || !missing(t.error.message), shareColumn: !c.error || !missing(c.error.message) };
});

export type CardContestRow = {
  id: string;
  slug: string;
  contest_number: number | null;
  brand_name: string;
  business_type: string;
  business_type_other: string | null;
  service: string | null;
  styles: string[] | null;
  style_sliders: Record<string, number> | null;
  colors: string[] | null;
  prize_amount: number;
  ends_at: string | null;
  starts_at: string | null;
  status: string;
  is_private: boolean;
  is_nda: boolean;
  share_on_facebook: boolean;
};
export const CONTEST_COLUMNS = "id, slug, contest_number, brand_name, business_type, business_type_other, service, styles, style_sliders, colors, prize_amount, ends_at, starts_at, status, is_private, is_nda, share_on_facebook";

export async function contestForCard(contestId: string): Promise<CardContestRow | null> {
  const { data } = await db().from("contests").select(CONTEST_COLUMNS).eq("id", contestId).maybeSingle();
  return (data as CardContestRow | null) ?? null;
}

/** "Restaurant & food", or the client's own words for "Other". */
function category(c: CardContestRow): string {
  if (c.business_type === "other" && c.business_type_other) return cleanText(c.business_type_other, 40);
  return (en.wizard.businessTypes as Record<string, string>)[c.business_type] ?? "";
}

/** Two style words from the brief: the mood sliders first (Playful/Serious, Modern/Classic, Minimal/Complex), then logo types. */
function styleWords(c: CardContestRow): string[] {
  const out: string[] = [];
  const sl = c.style_sliders ?? {};
  for (const key of ["tone", "era", "complexity"] as const) {
    const v = sl[key];
    const labels = en.wizard.sliders[key];
    if (typeof v === "number" && v <= 2) out.push(labels.left);
    if (typeof v === "number" && v >= 4) out.push(labels.right);
  }
  for (const s of c.styles ?? []) out.push((en.wizard.styles as Record<string, string>)[s] ?? "");
  return out.filter(Boolean).slice(0, 2);
}

/** What the card and the caption say. Never the client's name, photo, phone, email or payment details. */
export async function cardFacts(c: CardContestRow, now: Date, lineBn: string | null, last24: boolean) {
  const svc = c.service && !isLogo(c.service) ? await getService(c.service) : null;
  const cat = category(c);
  const what = svc ? `${svc.name.en} design` : "Logo design";
  const number = c.contest_number ?? 0;
  const ends = c.ends_at ? new Date(c.ends_at) : now;
  const data: CardData = {
    brand: cardBrand(c.brand_name),
    kicker: cat ? `${what} · ${cat}` : what,
    lineBn: lineBn ?? banglaLine(c.contest_number),
    words: styleWords(c),
    colors: c.colors ?? [],
    prize: c.prize_amount,
    daysLeft: daysLeft(ends, now),
    endText: endDateText(ends),
    code: contestCode(number),
    link: shortLinkText(number),
    last24,
  };
  // The post's link follows Admin › Settings › Backup links (owner, 2026-10-21); the card itself always prints .bd.
  return { data, category: cat || what, link: `${await linkOrigin()}${shortLinkPath(number)}` };
}

export async function makeCaption(c: CardContestRow, now: Date): Promise<string> {
  const s = await getSettings(["cards.caption", "cards.hashtags"]);
  const { data, category: cat, link } = await cardFacts(c, now, null, false);
  return fillCaption(s["cards.caption"], {
    brand_name: cleanText(c.brand_name, 80),
    category: cleanText(cat, 60),
    prize: prizeText(c.prize_amount),
    days_left: String(data.daysLeft),
    end_date: data.endText,
    contest_link: link,
    hashtags: cleanHashtags(s["cards.hashtags"]).join(" "),
  });
}

/**
 * The four stored pictures (a high-quality JPEG each: posted to Facebook and downloaded), their small display copies
 * (a 400 px WebP of about 15–20 KB, shown in Admin; owner, 2026-10-27), when they were drawn (v, for fresh links) and
 * with which template version (t). Cards drawn before 2026-10-27 are PNG with no display copies.
 */
export type CardImages = Partial<Record<CardSizeKey, string>> & { small?: Partial<Record<CardSizeKey, string>>; v?: number; t?: number };

export const publicUrl = (path: string, v?: number) => `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/${CARDS_BUCKET}/${path}${v ? `?v=${v}` : ""}`;
export const imageUrl = (images: CardImages, size: CardSizeKey) => (images[size] ? publicUrl(images[size]!, images.v) : null);
/** The small display copy where there is one, else the picture itself. */
export const smallUrl = (images: CardImages, size: CardSizeKey) => (images.small?.[size] ? publicUrl(images.small[size]!, images.v) : imageUrl(images, size));

/**
 * Draws the four sizes and stores each as <contest>/<kind>-<style>-<size>.jpg plus its display copy -400.webp (a new
 * drawing replaces the old one). Owner, 2026-10-27: the PNGs were about 3.3 MB a contest; the JPEGs (quality 85, no
 * visible change) are about 0.35 MB and the display copies about 55 KB.
 */
export async function drawCard(c: CardContestRow, kind: CardKind, style: CardStyle, lineBn: string | null, now: Date): Promise<CardImages> {
  const { data } = await cardFacts(c, now, lineBn, kind === "last24");
  const pngs = await renderCard(data, style);
  const images: CardImages = { v: now.getTime(), t: CARD_TEMPLATE_VERSION, small: {} };
  const store = (path: string, bytes: Uint8Array, contentType: string) =>
    // A day: a new drawing changes ?v=, so nobody sees an old one.
    db().storage.from(CARDS_BUCKET).upload(path, bytes, { contentType, upsert: true, cacheControl: "86400" });
  for (const s of CARD_SIZES) {
    const base = `${c.id}/${kind}-${style}-${s.key}`;
    const [jpg, small] = await Promise.all([
      sharp(pngs[s.key]).jpeg({ quality: 85, mozjpeg: true }).toBuffer(),
      sharp(pngs[s.key]).resize({ width: 400 }).webp({ quality: 75, effort: 5 }).toBuffer(),
    ]);
    for (const [path, bytes, type] of [[`${base}.jpg`, jpg, "image/jpeg"], [`${base}-400.webp`, small, "image/webp"]] as const) {
      const { error } = await store(path, new Uint8Array(bytes), type);
      if (error) throw new Error(`Storage: ${error.message}`);
    }
    images[s.key] = `${base}.jpg`;
    images.small![s.key] = `${base}-400.webp`;
  }
  // The same card drawn before as PNG is replaced by these.
  await db().storage.from(CARDS_BUCKET).remove(CARD_SIZES.map((s) => `${c.id}/${kind}-${style}-${s.key}.png`)).catch(() => null);
  return images;
}

export type CardRow = {
  id: string;
  contest_id: string;
  kind: CardKind;
  style: CardStyle;
  line_bn: string | null;
  images: CardImages;
  caption: string | null;
  status: CardStatus;
  skip_reason: string | null;
  fb_post_id: string | null;
  fb_post_url: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  posted_by: string | null;
  error: string | null;
  attempts: number;
  tried_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CardListItem = CardRow & { contest: { slug: string; number: number | null; brand: string; prize: number; startsAt: string | null; endsAt: string | null; status: string } };

export async function listCards(limit = 60): Promise<CardListItem[]> {
  const { data, error } = await db()
    .from("contest_cards")
    .select("*, contest:contests!contest_id(slug, contest_number, brand_name, prize_amount, starts_at, ends_at, status)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).flatMap((r) => {
    const c = (Array.isArray(r.contest) ? r.contest[0] : r.contest) as { slug: string; contest_number: number | null; brand_name: string; prize_amount: number; starts_at: string | null; ends_at: string | null; status: string } | null;
    if (!c) return [];
    const { contest: _drop, ...row } = r as CardRow & { contest: unknown };
    void _drop;
    return [{ ...row, contest: { slug: c.slug, number: c.contest_number, brand: c.brand_name, prize: c.prize_amount, startsAt: c.starts_at, endsAt: c.ends_at, status: c.status } }];
  });
}

export async function cardById(id: string): Promise<CardRow | null> {
  const { data } = await db().from("contest_cards").select("*").eq("id", id).maybeSingle();
  return (data as CardRow | null) ?? null;
}

export async function updateCard(id: string, patch: Partial<CardRow>): Promise<void> {
  const { error } = await db().from("contest_cards").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** The four numbers at the top of Admin › Contest cards. */
export async function cardStats(): Promise<{ made: number; since: string | null; posted: number; byHand: number; waiting: number; oldestWaiting: string | null; failed: number }> {
  const { data } = await db().from("contest_cards").select("status, created_at, posted_by, attempts").limit(5000);
  const rows = (data ?? []) as { status: CardStatus; created_at: string; posted_by: string | null; attempts: number }[];
  const made = rows.filter((r) => r.status !== "skipped");
  const waiting = rows.filter((r) => r.status === "waiting").map((r) => r.created_at).sort();
  return {
    made: made.length,
    since: made.map((r) => r.created_at).sort()[0] ?? null,
    posted: rows.filter((r) => r.status === "posted").length,
    byHand: rows.filter((r) => r.status === "posted" && r.posted_by).length,
    waiting: waiting.length,
    oldestWaiting: waiting[0] ?? null,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}
