import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { hasBangla, localizedPath } from "@/lib/i18n/lang-path";
import { publishedGuides } from "@/lib/guides/queries";
import { LEGAL_SLUGS } from "@/lib/legal/types";
import { searchIndexingOn, siteUrl } from "@/lib/seo";
import { safeListingCounts } from "@/lib/seo/listings";
import { createAdminClient } from "@/lib/supabase/admin";

// Rebuilt at most once an hour.
export const revalidate = 3600;

const PUBLIC_CONTEST_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

/** When the search landing pages' words last changed (keep in step with their content modules' updatedAt). */
const LANDING_UPDATED = new Date("2026-10-21T00:00:00Z");

/**
 * Every page twice (owner, 2026-10-21): the English address and the Bangla one (?lang=bn), each naming the other, so
 * search engines find and match both languages.
 */
function bothLanguages(list: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return list.flatMap((e) => {
    const u = new URL(e.url);
    const path = u.pathname + u.search;
    // Next.js writes these as they are: an "&" between two settings must be escaped for the XML.
    const xml = (url: string) => url.replace(/&/g, "&amp;");
    const en = xml(`${u.origin}${localizedPath(path, "en")}`);
    const bn = xml(`${u.origin}${localizedPath(path, "bn")}`);
    const alternates = { languages: { en, bn, "x-default": en } };
    return [
      { ...e, url: en, alternates },
      { ...e, url: bn, alternates },
    ];
  });
}

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
  // Bangla text yet only has its English address (owner, 2026-10-21).
  const guides = await publishedGuides();
  const englishOnly: MetadataRoute.Sitemap = [];
  if (guides.length) {
    pages.push({ url: `${base}/guides`, lastModified: new Date(guides[0].published_at), changeFrequency: "weekly", priority: 0.6 });
    for (const g of guides) (g.bn_ready ? pages : englishOnly).push({ url: `${base}/guides/${g.slug}`, lastModified: new Date(g.updated_at), changeFrequency: "monthly", priority: 0.6 });
  }
  if (!isSupabaseConfigured()) return [...englishOnly, ...bothLanguages(pages)];

  const db = createAdminClient();
  const [contests, entries] = await Promise.all([
    db
      .from("contests")
      .select("slug, updated_at, status, business_description, client:profiles!client_id!inner(is_test)")
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
      .select("designer_id, created_at, contest:contests!contest_id!inner(is_private, is_blind, is_nda, status)")
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
  for (const e of entries.data ?? []) if (!latest.has(e.designer_id as string)) latest.set(e.designer_id as string, e.created_at as string);
  const designers = latest.size ? await db.from("profiles").select("id, username").in("id", [...latest.keys()]).eq("role", "designer").eq("status", "active").eq("is_test", false).not("username", "is", null) : { data: [], error: null };
  logError("designers", designers.error);

  const contestEntry = (c: { slug: string; updated_at: string; status: string }) => ({
    url: `${base}/contest/${c.slug}`,
    lastModified: new Date(c.updated_at),
    changeFrequency: (c.status === "open" ? "daily" : "monthly") as "daily" | "monthly",
    priority: c.status === "open" ? 0.8 : 0.5,
  });
  // A contest whose brief is in English is listed in English only, like its page (owner, 2026-10-21).
  const contestRows = (contests.data ?? []) as { slug: string; updated_at: string; status: string; business_description: string | null }[];
  return [
    ...englishOnly,
    ...contestRows.filter((c) => !hasBangla(c.business_description)).map(contestEntry),
    ...bothLanguages([
      ...pages,
      ...contestRows.filter((c) => hasBangla(c.business_description)).map(contestEntry),
      ...(designers.data ?? []).map((d) => ({ url: `${base}/d/${d.username}`, lastModified: new Date(latest.get(d.id as string)!), changeFrequency: "weekly" as const, priority: 0.5 })),
    ]),
  ];
}
