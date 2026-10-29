import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { homeLogosChanged } from "./logos";

/**
 * "Bangladesh's best designers are joining every day" (owner, 2026-10-29; Design/logocontest-site/index.html): the
 * newest designers in two moving rows on the home page. live-designers.ts only lets numbers and three faces out; the
 * owner asked for this wall, so a designer's public name, username (their /d/ profile link) and photo leave this file,
 * and nothing else: no id, email, phone, address or city (the site stores no city, and designer_agreements' address
 * is private). Active designers only: no admins, test, suspended, banned or deleted accounts.
 */

/** The newest this many designers (owner, 2026-10-29). */
export const WALL_SIZE = 30;
/** Fewer than this many and the whole section is hidden: two thin rows look empty. */
export const WALL_MIN = 8;
/** "Just joined" on the newest three … */
export const JUST_JOINED = 3;
/** … unless they joined longer ago than this many days, when "just" would not be true. */
export const JUST_JOINED_DAYS = 30;
/** Cards in one copy of a row at least, so a short row still fills a wide screen while it moves. */
export const ROW_MIN_CARDS = 14;
/** Initials tints, in the design's order (red, blue, green, gold, purple, grey); the second row starts at gold. */
export const WALL_TONES = 6;

export type WallDesigner = { name: string; username: string; photo: string | null; joinedAt: string };
export type JoinedAgo = { key: MessageKey; n: number };
export type WallCard = { name: string; username: string; photo: string | null; initials: string; tone: number; fresh: boolean; ago: JoinedAgo };

const DAY = 86_400_000;
const DHAKA = 6 * 3_600_000;
const dhakaDay = (ms: number) => Math.floor((ms + DHAKA) / DAY);

/**
 * "Joined today / yesterday / 5 days ago / 3 weeks ago / 2 months ago / 1 year ago", counted in Bangladesh calendar
 * days (a designer who joined at 11 pm joined "yesterday" an hour later). A time in the future reads "today".
 */
export function joinedAgo(joinedAt: Date | string, now: Date): JoinedAgo {
  const days = Math.max(0, dhakaDay(now.getTime()) - dhakaDay(new Date(joinedAt).getTime()));
  if (days === 0) return { key: "home2.wall.joined.today", n: 0 };
  if (days === 1) return { key: "home2.wall.joined.yesterday", n: 1 };
  if (days < 7) return { key: "home2.wall.joined.days", n: days };
  const unit = (n: number, one: MessageKey, many: MessageKey): JoinedAgo => ({ key: n === 1 ? one : many, n });
  if (days < 30) return unit(Math.floor(days / 7), "home2.wall.joined.week", "home2.wall.joined.weeks");
  if (days < 365) return unit(Math.floor(days / 30), "home2.wall.joined.month", "home2.wall.joined.months");
  return unit(Math.floor(days / 365), "home2.wall.joined.year", "home2.wall.joined.years");
}

/**
 * Two letters for a card without a photo: the first letters of the first two words, skipping short forms such as
 * "Md." or "Mst." when more of the name follows ("Md. Rakib Hasan" is RH). Same idea as live-designers.ts, whose copy
 * stays private to that file. Works for Bangla names too.
 */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const full = words.filter((w) => !w.endsWith("."));
  return (
    (full.length ? full : words)
      .slice(0, 2)
      .map((w) => Array.from(w)[0]!.toUpperCase())
      .join("") || "•"
  );
}

/**
 * Newest first, dealt alternately into two rows (1st, 3rd, 5th … on top; 2nd, 4th … below), each card ready to draw.
 */
export function wallRows(list: WallDesigner[], now: Date): [WallCard[], WallCard[]] {
  const rows: [WallCard[], WallCard[]] = [[], []];
  list.forEach((d, i) => {
    const row = rows[i % 2]!;
    const recent = now.getTime() - new Date(d.joinedAt).getTime() <= JUST_JOINED_DAYS * DAY;
    row.push({
      name: d.name,
      username: d.username,
      photo: d.photo,
      initials: initials(d.name),
      tone: (row.length + (i % 2) * 3) % WALL_TONES,
      fresh: i < JUST_JOINED && recent,
      ago: joinedAgo(d.joinedAt, now),
    });
  });
  return rows;
}

/**
 * How many times one row is drawn before it repeats (the CSS moves the track by half, so the page draws twice this):
 * enough copies for at least ROW_MIN_CARDS cards, so a short row never leaves a gap on a wide screen.
 */
export function copiesFor(cards: number): number {
  return cards > 0 ? Math.max(1, Math.ceil(ROW_MIN_CARDS / cards)) : 0;
}

export const DESIGNER_WALL_TAG = "designer-wall";

/**
 * A designer's name, photo or account changed (banned, suspended, deleted, marked as a test account): the home page's
 * designer wall and winners are read again on the next view, not up to 10 minutes later (review, 2026-10-29).
 */
export function homeDesignersChanged() {
  try {
    updateTag(DESIGNER_WALL_TAG);
  } catch {
    revalidateTag(DESIGNER_WALL_TAG, "max");
  }
  homeLogosChanged();
}

/**
 * The newest WALL_SIZE active designers, read at most once every 10 minutes (owner, 2026-10-29: "do what's best" for
 * speed and the bill). A failed read throws, so it is never kept; designerWall() then hides the section.
 */
export const newestDesigners = unstable_cache(
  async (): Promise<WallDesigner[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("name, username, avatar_path, created_at")
      .eq("role", "designer")
      .eq("status", "active")
      .eq("is_test", false)
      .not("username", "is", null)
      // Email confirmed (review, 2026-10-29): only designers who can send designs, and a spot costs a real inbox.
      .not("email_verified_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(WALL_SIZE);
    if (error) throw new Error(error.message);
    return (data ?? []).flatMap((p) => {
      const name = ((p.name as string | null) ?? "").trim();
      const username = (p.username as string | null) ?? "";
      if (!name || !username) return [];
      return [{ name, username, photo: avatarUrl(p.avatar_path as string | null), joinedAt: p.created_at as string }];
    });
  },
  ["designer-wall-v2"],
  { revalidate: 600, tags: [DESIGNER_WALL_TAG] },
);

/** The two rows for the home page, or null (no section) below WALL_MIN designers or when the database can't answer. */
export async function designerWall(now = new Date()): Promise<[WallCard[], WallCard[]] | null> {
  const list = await newestDesigners().catch(() => null);
  return list && list.length >= WALL_MIN ? wallRows(list, now) : null;
}
