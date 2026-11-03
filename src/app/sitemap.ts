import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { isPublicDesign, isShareableDesign, type EntryStatus } from "@/lib/entries/rules";
import { hasBangla, localizedPath } from "@/lib/i18n/lang-path";
import { publishedGuides } from "@/lib/guides/queries";
import { LEGAL_SLUGS } from "@/lib/legal/types";
import { searchIndexingOn, siteUrl } from "@/lib/seo";
import { safeListingCounts } from "@/lib/seo/listings";
import { publicImagePath } from "@/lib/storage/view-links";
import { createAdminClient } from "@/lib/supabase/admin";

// Rebuilt at most once an hour.
export const revalidate = 3600;

const PUBLIC_CONTEST_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

/** When the search landing pages' words last changed (keep in step with their content modules' updatedAt). */
const LANDING_UPDATED = new Date("2026-10-21T00:00:00Z");

/** An address in one language: Bangla plain, English under /en (owner, 2026-11-03). */
const inLanguage = (url: string, locale: "en" | "bn") => {
  const u = new URL(url);
  // Next.js writes these as they are: an "&" between two settings must be escaped for the XML.
  return `${u.origin}${localizedPath(u.pathname + u.search, locale)}`.replace(/&/g, "&amp;");
};

/**
 * Every page twice: the Bangla address (plain) and the English one (/en/…), each naming the other and Bangla as the
 * default, so search engines find and match both languages. Only clean canonical addresses, never ?lang=.
 */
function bothLanguages(list: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return list.flatMap((e) => {
    const bn = inLanguage(e.url, "bn");
    const en = inLanguage(e.url, "en");
    const alternates = { languages: { bn, en, "x-default": bn } };
    return [
      { ...e, url: bn, alternates },
      { ...e, url: en, alternates },
    ];
  });
}

/** A page whose text is English only: its /en address alone. */
const englishAddress = (e: MetadataRoute.Sitemap[number]) => ({ ...e, url: inLanguage(e.url, "en") });

const logError = (what: string, error: { message: string } | null) => {
  if (error) console.error(`[sitemap] ${what}:`, error.message);
};

/**
 * /sitemap.xml (BLUEPRINT §15.1): public pages, guides, public contests and designer profiles. Empty lists, the
 * leaderboard and test accounts are left out (owner, 2026-10-21): they are kept out of search engines too.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!searchIndexingOn()) return [];
  const base = siteUrl();
  // When the counts can't be read, every list is listed (better than leaving real pages out).
  const counts = (await safeListingCounts()) ?? { contests: 1, winners: 1, designs: 1 };
  const pages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/logo-design-price`, lastModified: LANDING_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/logo-design`, lastModified: LANDING_UPDATED, changeFrequency: "monthly", priority: 0.9 },
    ...(counts.contests ? [{ url: `${base}/contests`, changeFrequency: "hourly" as const, priority: 0.8 }] : []),
    ...(counts.designs ? [{ url: `${base}/design-studio`, changeFrequency: "daily" as const, priority: 0.6 }] : []),
    ...(counts.winners ? [{ url: `${base}/winners`, changeFrequency: "daily" as const, priority: 0.7 }] : []),
    { url: `${base}/logo-checker`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/how-it-works?for=designers`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/designers/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, lastModified: LANDING_UPDATED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.5 },
    ...LEGAL_SLUGS.map((slug) => ({ url: `${base}/legal/${slug}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
  // Guides (owner, 2026-10-15): the list once there is something in it, and every published guide. A guide without its
  // Bangla text yet only has its English address (owner, 2026-10-21), /en/guides/… since 2026-11-03.
  const guides = await publishedGuides();
  const englishOnly: MetadataRoute.Sitemap = [];
  if (guides.length) {
    pages.push({ url: `${base}/guides`, lastModified: new Date(guides[0].published_at), changeFrequency: "weekly", priority: 0.6 });
    for (const g of guides) (g.bn_ready ? pages : englishOnly).push({ url: `${base}/guides/${g.slug}`, lastModified: new Date(g.updated_at), changeFrequency: "monthly", priority: 0.6 });
  }
  if (!isSupabaseConfigured()) return [...englishOnly.map(englishAddress), ...bothLanguages(pages)];

  const db = createAdminClient();
  const [contests, entries] = await Promise.all([
    db
      .from("contests")
      .select("id, slug, updated_at, status, is_blind, winner_is_public, business_description, brand_name, slogan, target_audience, client:profiles!client_id!inner(is_test)")
      .in("status", PUBLIC_CONTEST_STATUSES)
      .eq("is_private", false)
      .eq("is_nda", false)
      .is("deleted_at", null)
      .eq("client.is_test", false)
      .order("updated_at", { ascending: false })
      .limit(5000),
    // Designers with at least one design that is shown publicly (not private, not blind).
    db
      .from("entries")
      .select("designer_id, created_at, status, is_hidden, contest:contests!contest_id!inner(is_private, is_blind, is_nda, status, winner_is_public)")
      .in("status", ["active", "winner"])
      .eq("contest.is_private", false)
      .eq("contest.is_blind", false)
      .eq("contest.is_nda", false)
      .in("contest.status", PUBLIC_CONTEST_STATUSES)
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);
  logError("contests", contests.error);
  logError("designs", entries.error);

  // The lists changed when their newest contest or design did.
  const newestContest = contests.data?.[0]?.updated_at as string | undefined;
  const newestDesign = entries.data?.[0]?.created_at as string | undefined;
  for (const p of pages) {
    const path = p.url.slice(base.length) || "/";
    if ((path === "/" || path === "/contests") && newestContest) p.lastModified = new Date(newestContest);
    if ((path === "/design-studio" || path === "/winners") && newestDesign) p.lastModified = new Date(newestDesign);
  }

  const latest = new Map<string, string>();
  // Only designs the profile itself counts (a Pro designer's hidden design isn't public until the winner is picked), so
  // a profile listed here is never one that tells search engines to stay away (seen 2026-11-03).
  const one = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);
  for (const e of entries.data ?? []) {
    const c = one(e.contest as { is_private: boolean; is_blind: boolean; status: string; winner_is_public: boolean } | { is_private: boolean; is_blind: boolean; status: string; winner_is_public: boolean }[]);
    if (!isPublicDesign({ status: e.status as EntryStatus, isHidden: e.is_hidden as boolean | null }, { status: c.status, isPrivate: c.is_private, isBlind: c.is_blind, winnerIsPublic: c.winner_is_public })) continue;
    if (!latest.has(e.designer_id as string)) latest.set(e.designer_id as string, e.created_at as string);
  }
  const designers = latest.size ? await db.from("profiles").select("id, username").in("id", [...latest.keys()]).eq("role", "designer").eq("status", "active").eq("is_test", false).not("username", "is", null) : { data: [], error: null };
  logError("designers", designers.error);

  const contestEntry = (c: { slug: string; updated_at: string; status: string }) => ({
    url: `${base}/contest/${c.slug}`,
    lastModified: new Date(c.updated_at),
    changeFrequency: (c.status === "open" ? "daily" : "monthly") as "daily" | "monthly",
    priority: c.status === "open" ? 0.8 : 0.5,
  });
  // A contest whose brief is in English is listed in English only, like its page (owner, 2026-10-21). With no
  // description (onboarding v2), its name, slogan and customers tell the language, as on the page (browse.ts, 2026-10-29).
  const contestRows = (contests.data ?? []) as { id: string; slug: string; updated_at: string; status: string; is_blind: boolean; winner_is_public: boolean; business_description: string | null; brand_name: string; slogan: string | null; target_audience: string | null }[];
  const bangla = (c: (typeof contestRows)[number]) => hasBangla(c.business_description?.trim() || [c.brand_name, c.slogan, c.target_audience].filter(Boolean).join(" "));

  // The designers' logos for Google Images (owner, 2026-11-03): each contest page with its public designs' first
  // pictures (the winner first), and each winning design's page with all its pictures, at addresses that never change.
  const secret = process.env.OTP_SECRET;
  const byId = new Map(contestRows.map((c) => [c.id, c]));
  const designs: { contest: (typeof contestRows)[number]; number: number; winner: boolean; created: string; pictures: string[] }[] = [];
  if (secret && contestRows.length) {
    const { data, error } = await db
      .from("entries")
      .select("contest_id, number, status, is_hidden, created_at, images:entry_images!entry_id(position, preview_path)")
      .in("contest_id", [...byId.keys()])
      .in("status", ["active", "winner"])
      .order("created_at", { ascending: false })
      .limit(10000);
    logError("design pictures", error);
    for (const e of data ?? []) {
      const c = byId.get(e.contest_id as string);
      if (!c) continue;
      const status = e.status as EntryStatus;
      if (!isShareableDesign({ status, isHidden: e.is_hidden as boolean | null }, { status: c.status, isPrivate: false, isNda: false, isBlind: c.is_blind, winnerIsPublic: c.winner_is_public })) continue;
      const images = [...((e.images as { position: number; preview_path: string }[] | null) ?? [])].sort((a, b) => a.position - b.position);
      const pictures = images.map((i) => `${base}${publicImagePath(secret, i.preview_path, 1000, c.brand_name)}`);
      if (pictures.length) designs.push({ contest: c, number: e.number as number, winner: status === "winner", created: e.created_at as string, pictures });
    }
  }
  const coversOf = new Map<string, string[]>();
  for (const d of [...designs].sort((a, b) => Number(b.winner) - Number(a.winner))) {
    const list = coversOf.get(d.contest.id) ?? [];
    if (list.length < 20) list.push(d.pictures[0]);
    coversOf.set(d.contest.id, list);
  }
  const withCovers = (c: (typeof contestRows)[number]) => ({ ...contestEntry(c), ...(coversOf.get(c.id)?.length ? { images: coversOf.get(c.id) } : {}) });
  // Only a winning design's own page is in search engines (owner, 2026-10-21); the others' pictures come with the contest.
  const designPages = designs.filter((d) => d.winner).map((d) => ({
    url: `${base}/contest/${d.contest.slug}/design/${d.number}`,
    lastModified: new Date(d.created),
    changeFrequency: "monthly" as const,
    priority: d.winner ? 0.6 : 0.4,
    images: d.pictures,
  }));
  return [
    ...englishOnly.map(englishAddress),
    ...contestRows.filter((c) => !bangla(c)).map(withCovers).map(englishAddress),
    ...bothLanguages([
      ...pages,
      ...contestRows.filter(bangla).map(withCovers),
      ...designPages,
      ...(designers.data ?? []).map((d) => ({ url: `${base}/d/${d.username}`, lastModified: new Date(latest.get(d.id as string)!), changeFrequency: "weekly" as const, priority: 0.5 })),
    ]),
  ];
}
