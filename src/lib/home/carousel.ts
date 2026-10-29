import "server-only";
import { unstable_cache } from "next/cache";
import { addonRank } from "@/lib/contests/addon-order";
import type { BusinessType, PackageKey } from "@/lib/contests/brief";
import { isSupabaseConfigured } from "@/lib/env";
import { SHOWN_STATUSES } from "@/lib/entries/rules";
import { earlyCutoff } from "@/lib/pro/limits";
import { contestServiceInfo } from "@/lib/services/contest-service";
import { allServices } from "@/lib/services/store";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * "Contests live right now", the home carousel (owner, 2026-10-29; Design/logocontest-site/index.html). A lighter
 * read than liveContests() in contests/browse.ts: no cover pictures and no designer faces, as the cards show a letter
 * tile. The rules for public live contests stay the same: open only, never a test client's contest, Pro early access,
 * and a private or NDA contest is "Private contest" with a lock, its name (and its slug, which is made from the name)
 * never leaving the server.
 */

/** At most this many contests in the carousel (owner, 2026-10-29). */
export const CAROUSEL_MAX = 12;

export type CarouselContest = {
  id: string;
  /** For the link to the contest page; null for a private or NDA contest, as the slug is made from its name. */
  slug: string | null;
  /** The business name; null for a private or NDA contest (shown as "Private contest" with a lock). */
  name: string | null;
  businessType: BusinessType;
  /** A non-logo contest's service name (owner, 2026-10-13), shown in place of the business type; null for logos. */
  kind: { en: string; bn: string } | null;
  package: PackageKey;
  urgent: boolean;
  highlighted: boolean;
  /** In taka; shown with price() so visitors from abroad see US dollars. */
  prize: number;
  /** Shown designs (active and winning), as on the browse page. */
  designs: number;
  /** ISO time; text, as it comes back from the cache. */
  endsAt: string | null;
};

const COLUMNS = "id, slug, brand_name, business_type, package, prize_amount, starts_at, ends_at, is_private, is_nda, is_promoted, is_urgent, is_highlighted";

export type CarouselRow = {
  id: string;
  slug: string;
  brand_name: string;
  business_type: string;
  package: string;
  prize_amount: number;
  starts_at: string | null;
  ends_at: string | null;
  is_private: boolean;
  is_nda: boolean;
  is_promoted: boolean;
  is_urgent: boolean;
  is_highlighted: boolean;
  /** The client's profile, for is_test. */
  owner?: unknown;
};

const time = (v: string | null) => (v ? new Date(v).getTime() : null);
const testOwner = (o: unknown) => Boolean(((Array.isArray(o) ? o[0] : o) as { is_test?: boolean } | null)?.is_test);

/**
 * The open contests the carousel shows, in the browse page's open-tab order: paid add-ons first (addon-order.ts), then
 * ending soonest, contests without an end last; at most `limit`. Never a test client's contest (owner, 2026-10-22);
 * with Pro early access (owner, 2026-10-13) a contest that opened after `hideNewerThan` isn't shown yet.
 */
export function pickLive(rows: CarouselRow[], hideNewerThan: Date | null, limit = CAROUSEL_MAX): CarouselRow[] {
  const cut = hideNewerThan ? hideNewerThan.getTime() : null;
  const early = (r: CarouselRow) => cut !== null && r.starts_at !== null && (time(r.starts_at) ?? 0) > cut;
  const rank = (r: CarouselRow) => addonRank({ isPromoted: r.is_promoted, isUrgent: r.is_urgent, isHighlighted: r.is_highlighted, isPrivate: r.is_private, isNda: r.is_nda });
  const ending = (a: CarouselRow, b: CarouselRow) => {
    const [x, y] = [time(a.ends_at), time(b.ends_at)];
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    return x - y;
  };
  return rows
    .filter((r) => !testOwner(r.owner) && !early(r))
    .sort((a, b) => rank(a) - rank(b) || ending(a, b))
    .slice(0, Math.max(0, limit));
}

/** One card's facts. A private or NDA contest keeps neither its name nor its slug. */
export function toCarousel(r: CarouselRow, designs: number, kind: CarouselContest["kind"]): CarouselContest {
  const hidden = Boolean(r.is_private || r.is_nda);
  return {
    id: r.id,
    slug: hidden ? null : r.slug,
    name: hidden ? null : r.brand_name,
    businessType: r.business_type as BusinessType,
    kind,
    package: r.package as PackageKey,
    urgent: Boolean(r.is_urgent),
    highlighted: Boolean(r.is_highlighted),
    prize: r.prize_amount,
    designs,
    endsAt: r.ends_at,
  };
}

const letters = new Intl.Segmenter("en", { granularity: "grapheme" });

/**
 * The letter tile's initials: the first letter of the first two words ("Padma Tech" → "PT"), one letter for a single
 * word. Whole letters, so a Bangla letter keeps its vowel sign; signs like "&" are skipped. "•" when there are none,
 * as on BrandTile.
 */
export function tileInitials(name: string): string[] {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean);
  if (!words.length) return ["•"];
  return words.slice(0, 2).map((w) => ([...letters.segment(w)][0]?.segment ?? "").toUpperCase());
}

/**
 * Shown designs (active and winning) per contest, counted by the database: no rows come back, so the count stays right
 * however many designs a contest has (review, 2026-10-29). A failed count throws, so the minute's list isn't kept.
 */
async function shownCounts(ids: string[]): Promise<Map<string, number>> {
  const db = createAdminClient();
  const counts = await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await db.from("entries").select("id", { count: "exact", head: true }).eq("contest_id", id).in("status", SHOWN_STATUSES);
      if (error) throw new Error(error.message);
      return [id, count ?? 0] as const;
    }),
  );
  return new Map(counts);
}

async function loadCarousel(hideNewerThan: Date | null): Promise<CarouselContest[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("contests")
    .select(`${COLUMNS}, owner:profiles!client_id(is_test)`)
    .eq("status", "open")
    .order("ends_at", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = pickLive((data ?? []) as CarouselRow[], hideNewerThan);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [designs, info, services] = await Promise.all([shownCounts(ids), contestServiceInfo(ids), allServices()]);
  return rows.map((r) => {
    const service = info.get(r.id)?.service ?? "logo";
    return toCarousel(r, designs.get(r.id) ?? 0, service === "logo" ? null : (services.find((s) => s.slug === service)?.name ?? null));
  });
}

// Visitors who aren't signed in share one list for a minute (as guestLiveContests() in contests/browse.ts).
const cachedCarousel = unstable_cache((cutoff: string | null) => loadCarousel(cutoff ? new Date(cutoff) : null), ["home-carousel-v2"], { revalidate: 60 });

/** The carousel's contests for this viewer: guests share the minute's list, signed-in viewers (admins) see it live. */
export async function carouselContests(viewer: { id: string; role: string } | null): Promise<CarouselContest[]> {
  const cut = await earlyCutoff(viewer);
  if (viewer) return loadCarousel(cut);
  // The early-access cutoff moves every moment; to the minute, so a minute's visitors share one list.
  return cachedCarousel(cut ? new Date(Math.floor(cut.getTime() / 60_000) * 60_000).toISOString() : null);
}
