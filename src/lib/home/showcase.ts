import "server-only";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { earlyCutoff } from "@/lib/pro/limits";
import { getSettings } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  contestAllowed,
  contestDays,
  dhakaDay,
  entryAllowed,
  FEATURED_LOGOS,
  gridEntries,
  isFinished,
  isLive,
  LIVE_CARDS,
  LIVE_LOGOS,
  MORE_FINISHED,
  pickFeatured,
  pickWall,
  pinnedThenBest,
  type SContest,
  type SEntry,
} from "./showcase-rules";

/*
 * Home showcase (owner, 2026-11-20; Design/logocontest-home-showcase): the logo wall, the live contest cards and the
 * finished contests under the home hero, all from real contests. Blind, private and NDA contests never come in (the
 * database filter and contestAllowed() both say so); see showcase-rules.ts for every rule. The wall and finished part
 * is kept for an hour, the live cards for 5 minutes; Admin › Homepage can clear both at once.
 */

export type ShowLogo = { id: string; img: string; href: string; brand: string };
export type ShowLive = {
  id: string;
  href: string;
  brand: string;
  businessType: string;
  prize: number;
  endsAt: string | null;
  designs: number;
  /** ISO time of the newest design; null when it has none. */
  latestAt: string | null;
  logos: ShowLogo[];
};
export type ShowFeatured = {
  id: string;
  href: string;
  brand: string;
  businessType: string;
  prize: number;
  finishedAt: string | null;
  days: number;
  designs: number;
  designers: number;
  winner: { img: string; href: string; designer: { name: string; avatarUrl: string | null } | null };
  /** Up to 23 designs; `winner` marks the winning one. */
  logos: (ShowLogo & { winner: boolean })[];
};
export type ShowSmall = { id: string; href: string; brand: string; designs: number; img: string };

export type HomeShowcase = {
  /** Up to 3 rows of up to 16 logos. */
  wall: ShowLogo[][];
  /** Every design the showcase may show (the "300+" line rounds it). */
  total: number;
  liveCount: number;
  finishedCount: number;
  live: ShowLive[];
  featured: ShowFeatured | null;
  more: ShowSmall[];
};

export const HOME_SHOWCASE_TAG = "home-showcase";

/** Admin › Homepage "Refresh now", and every showcase switch: the home page shows it at once. */
export function homeShowcaseChanged() {
  try {
    updateTag(HOME_SHOWCASE_TAG);
  } catch {
    revalidateTag(HOME_SHOWCASE_TAG, "max");
  }
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const PAGE = 1000;
const MAX_ROWS = 20_000;

/** Every allowed contest in these statuses (blind, private, NDA, test and switched-off ones never come back). */
async function loadContests(statuses: string[]): Promise<SContest[]> {
  const db = createAdminClient();
  const out: SContest[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db
      .from("contests")
      .select("id, slug, brand_name, business_type, service, status, prize_amount, starts_at, ends_at, completed_at, winner_entry_id, is_private, is_nda, is_blind, home_show, owner:profiles!client_id(is_test)")
      .in("status", statuses)
      .eq("is_private", false)
      .eq("is_nda", false)
      .eq("is_blind", false)
      .eq("home_show", true)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const owner = one(r.owner as unknown as { is_test: boolean | null } | null);
      out.push({
        id: r.id as string,
        slug: r.slug as string,
        brand: r.brand_name as string,
        businessType: r.business_type as string,
        status: r.status as string,
        isPrivate: Boolean(r.is_private),
        isNda: Boolean(r.is_nda),
        isBlind: Boolean(r.is_blind),
        homeShow: r.home_show !== false,
        // A contest whose client can't be read counts as a test one: never shown.
        ownerIsTest: owner ? owner.is_test !== false : true,
        service: (r.service as string | null) ?? null,
        prize: (r.prize_amount as number | null) ?? 0,
        startsAt: (r.starts_at as string | null) ?? null,
        endsAt: (r.ends_at as string | null) ?? null,
        completedAt: (r.completed_at as string | null) ?? null,
        winnerEntryId: (r.winner_entry_id as string | null) ?? null,
      });
    }
    if ((data ?? []).length < PAGE) break;
  }
  return out.filter(contestAllowed);
}

/** Every shown design (active, winner, forfeited) of a public, non-blind contest in these statuses. */
async function loadEntries(statuses: string[]): Promise<SEntry[]> {
  const db = createAdminClient();
  const out: SEntry[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db
      .from("entries")
      .select("id, number, status, is_hidden, home_hidden, created_at, contest_id, designer_id, designer:profiles!designer_id(status, is_test), contest:contests!contest_id!inner(status, is_private, is_nda, is_blind, home_show)")
      .in("status", ["active", "winner", "forfeited"])
      .in("contest.status", statuses)
      .eq("contest.is_private", false)
      .eq("contest.is_nda", false)
      .eq("contest.is_blind", false)
      .eq("contest.home_show", true)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const d = one(r.designer as unknown as { status: string | null; is_test: boolean | null } | null);
      out.push({
        id: r.id as string,
        number: r.number as number,
        status: r.status as string,
        isHidden: Boolean(r.is_hidden),
        homeHidden: Boolean(r.home_hidden),
        createdAt: r.created_at as string,
        contestId: r.contest_id as string,
        designerId: r.designer_id as string,
        designerActive: d?.status === "active",
        designerIsTest: d ? d.is_test !== false : true,
      });
    }
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

/** Designs with an open report: kept off the showcase until the team decides. */
async function reportedIds(): Promise<Set<string>> {
  const { data, error } = await createAdminClient().from("reports").select("entry_id").eq("status", "open").limit(5000);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.entry_id as string));
}

/** Each design's first picture as a light WebP through /api/img (the CDN keeps it); designs without one drop out. */
async function pictures(entryIds: string[], width: number): Promise<Map<string, string>> {
  const ids = [...new Set(entryIds)];
  if (!ids.length) return new Map();
  const { data, error } = await createAdminClient().from("entry_images").select("entry_id, position, preview_path").in("entry_id", ids);
  if (error) throw new Error(error.message);
  const first = new Map<string, { position: number; path: string }>();
  for (const r of data ?? []) {
    const cur = first.get(r.entry_id as string);
    if (!cur || (r.position as number) < cur.position) first.set(r.entry_id as string, { position: r.position as number, path: r.preview_path as string });
  }
  const paths = [...first.values()].map((v) => v.path);
  const urls = await getFileStorage().createReadUrls(ENTRY_FILES_BUCKET, paths, 3600, { width });
  const out = new Map<string, string>();
  for (const [id, v] of first) {
    const url = urls.get(v.path);
    if (url) out.set(id, url);
  }
  return out;
}

const contestHref = (c: SContest) => `/contest/${c.slug}`;
const designHref = (c: SContest, e: SEntry) => `/contest/${c.slug}/design/${e.number}`;

type Shared = { contests: Map<string, SContest>; shown: SEntry[]; allowed: SEntry[] };

async function loadShared(statuses: string[]): Promise<Shared> {
  const [contestList, entries, reported] = await Promise.all([loadContests(statuses), loadEntries(statuses), reportedIds()]);
  const contests = new Map(contestList.map((c) => [c.id, c]));
  // `shown`: every design of these contests a visitor sees (the cards' counts, as on the contest page);
  // `allowed`: the ones the showcase may picture.
  const shown = entries.filter((e) => contests.has(e.contestId));
  const allowed = shown.filter((e) => entryAllowed(e, contests.get(e.contestId), reported));
  return { contests, shown, allowed };
}

const countBy = (list: SEntry[]) => {
  const m = new Map<string, number>();
  for (const e of list) m.set(e.contestId, (m.get(e.contestId) ?? 0) + 1);
  return m;
};

/** The wall, the count and the finished contests: the same for every visitor, kept an hour. */
async function loadWallAndFinished(pin: string, now: Date): Promise<Omit<HomeShowcase, "live" | "liveCount">> {
  const { contests, shown, allowed } = await loadShared(["open", "judging", "winner_selected", "handover", "completed", "no_result"]);
  const designs = countBy(shown);
  // Only finished contests whose winning design may show (a test or suspended designer's win can't be the big card).
  const allowedIds = new Set(allowed.map((e) => e.id));
  const finished = [...contests.values()].filter((c) => isFinished(c) && allowedIds.has(c.winnerEntryId!));
  const featured = pickFeatured(finished, pin, (id) => designs.get(id) ?? 0, now);
  const more = pinnedThenBest(
    finished.filter((c) => c.id !== featured?.id),
    [],
    (c) => (designs.get(c.id) ?? 0) * 1e13 + new Date(c.completedAt ?? 0).getTime() / 1e3,
    MORE_FINISHED,
  );

  // Pictures: wall candidates (winners and the newest), the featured grid and the winners of the small cards.
  const winners = allowed.filter((e) => e.status === "winner");
  const newest = [...allowed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 120);
  const featuredGrid = featured ? gridEntries(allowed.filter((e) => e.contestId === featured.id), featured.winnerEntryId, FEATURED_LOGOS) : [];
  const smallWinners = more.map((c) => allowed.find((e) => e.id === c.winnerEntryId)).filter((e): e is SEntry => Boolean(e));
  const featuredWinner = featured ? allowed.find((e) => e.id === featured.winnerEntryId) ?? null : null;
  const [thumbs, big] = await Promise.all([
    pictures([...winners, ...newest, ...featuredGrid, ...smallWinners].map((e) => e.id), 240),
    pictures(featuredWinner ? [featuredWinner.id] : [], 480),
  ]);

  const logo = (e: SEntry): ShowLogo | null => {
    const c = contests.get(e.contestId);
    const img = thumbs.get(e.id);
    return c && img ? { id: e.id, img, href: designHref(c, e), brand: c.brand } : null;
  };
  const wallPool = [...new Map([...winners, ...newest].map((e) => [e.id, e])).values()].filter((e) => thumbs.has(e.id));
  const wall = pickWall(wallPool, dhakaDay(now)).map((row) => row.map(logo).filter((l): l is ShowLogo => Boolean(l)));

  let featuredOut: ShowFeatured | null = null;
  if (featured && featuredWinner && big.has(featuredWinner.id)) {
    const { data: d } = await createAdminClient().from("profiles").select("name, avatar_path, profile_hidden").eq("id", featuredWinner.designerId).maybeSingle();
    // A designer who hid their profile shows without name or photo.
    const designer = d && !d.profile_hidden ? { name: d.name as string, avatarUrl: avatarUrl(d.avatar_path as string | null) } : null;
    featuredOut = {
      id: featured.id,
      href: contestHref(featured),
      brand: featured.brand,
      businessType: featured.businessType,
      prize: featured.prize,
      finishedAt: featured.completedAt,
      days: contestDays(featured),
      designs: designs.get(featured.id) ?? 0,
      designers: new Set(shown.filter((e) => e.contestId === featured.id).map((e) => e.designerId)).size,
      winner: { img: big.get(featuredWinner.id)!, href: designHref(featured, featuredWinner), designer },
      logos: featuredGrid.flatMap((e) => {
        const l = logo(e);
        return l ? [{ ...l, winner: e.id === featured.winnerEntryId }] : [];
      }),
    };
  }

  const moreOut = more.flatMap((c): ShowSmall[] => {
    const w = allowed.find((e) => e.id === c.winnerEntryId);
    const img = w ? thumbs.get(w.id) : undefined;
    return img ? [{ id: c.id, href: contestHref(c), brand: c.brand, designs: designs.get(c.id) ?? 0, img }] : [];
  });

  return { wall: wall.filter((r) => r.length > 0), total: allowed.length, finishedCount: finished.length, featured: featuredOut, more: moreOut };
}

/** The live cards and the live count: kept 5 minutes, so "new logo 30 minutes ago" stays near the truth. */
async function loadLive(pins: string[], now: Date, hideNewerThan: Date | null): Promise<Pick<HomeShowcase, "live" | "liveCount">> {
  const { contests, shown, allowed } = await loadShared(["open"]);
  const designs = countBy(shown);
  const latest = new Map<string, string>();
  for (const e of shown) if (!latest.has(e.contestId) || e.createdAt > latest.get(e.contestId)!) latest.set(e.contestId, e.createdAt);
  const live = [...contests.values()].filter((c) => isLive(c, now, hideNewerThan));
  const cards = pinnedThenBest(live, pins, (c) => designs.get(c.id) ?? 0, LIVE_CARDS);
  const grids = new Map(cards.map((c) => [c.id, [...allowed.filter((e) => e.contestId === c.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, LIVE_LOGOS)]));
  const thumbs = await pictures([...grids.values()].flat().map((e) => e.id), 240);
  return {
    liveCount: live.length,
    live: cards.map((c) => ({
      id: c.id,
      href: contestHref(c),
      brand: c.brand,
      businessType: c.businessType,
      prize: c.prize,
      endsAt: c.endsAt,
      designs: designs.get(c.id) ?? 0,
      latestAt: latest.get(c.id) ?? null,
      logos: (grids.get(c.id) ?? []).flatMap((e) => {
        const img = thumbs.get(e.id);
        return img ? [{ id: e.id, img, href: designHref(c, e), brand: c.brand }] : [];
      }),
    })),
  };
}

// The hour's part: the key holds the pinned contest and the day, so a new pin or a new day starts a new list.
const cachedWallAndFinished = unstable_cache((pin: string, day: string) => loadWallAndFinished(pin, new Date()).then((r) => ({ ...r, day })), ["home-showcase-wall-v2"], {
  tags: [HOME_SHOWCASE_TAG],
  revalidate: 3600,
});
const cachedLive = unstable_cache((pins: string, cutoff: string | null) => loadLive(pins ? pins.split(",") : [], new Date(), cutoff ? new Date(cutoff) : null), ["home-showcase-live-v1"], {
  tags: [HOME_SHOWCASE_TAG],
  revalidate: 300,
});

/**
 * The showcase for a visitor, or null when it is switched off or the database can't answer (the section then hides;
 * a failed read is never kept, as the loaders throw).
 */
export async function homeShowcase(): Promise<HomeShowcase | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const s = await getSettings(["home.showcase_on", "home.showcase_live_pins", "home.showcase_finished_pin"]);
    if (!s["home.showcase_on"]) return null;
    const now = new Date();
    const cut = await earlyCutoff(null, now);
    // To 5 minutes, so the cache key holds still while Pro early access moves the cutoff.
    const cutKey = cut ? new Date(Math.floor(cut.getTime() / 300_000) * 300_000).toISOString() : null;
    const [base, live] = await Promise.all([cachedWallAndFinished(s["home.showcase_finished_pin"], dhakaDay(now)), cachedLive(s["home.showcase_live_pins"].join(","), cutKey)]);
    return { wall: base.wall, total: base.total, finishedCount: base.finishedCount, featured: base.featured, more: base.more, ...live };
  } catch (e) {
    console.error("[home-showcase]", e instanceof Error ? e.message : e);
    return null;
  }
}
