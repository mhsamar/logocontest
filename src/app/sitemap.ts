import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { localizedPath } from "@/lib/i18n/url";
import { publishedGuides } from "@/lib/guides/queries";
import { LEGAL_SLUGS } from "@/lib/legal/types";
import { offersOn } from "@/lib/rewards/program";
import { searchIndexingOn, siteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";

// Rebuilt at most once an hour.
export const revalidate = 3600;

const PUBLIC_CONTEST_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

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

/** /sitemap.xml (BLUEPRINT §15.1): public pages, guides, public contests and designer profiles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!searchIndexingOn()) return [];
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/contests`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/design-studio`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/logo-checker`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/winners`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...((await offersOn()).program ? [{ url: `${base}/leaderboard`, lastModified: now, changeFrequency: "daily" as const, priority: 0.5 }] : []),
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/how-it-works?for=designers`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/designers/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.5 },
    ...LEGAL_SLUGS.map((slug) => ({ url: `${base}/legal/${slug}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
  // Guides (owner, 2026-10-15): the list once there is something in it, and every published guide.
  const guides = await publishedGuides();
  if (guides.length) {
    pages.push({ url: `${base}/guides`, lastModified: new Date(guides[0].published_at), changeFrequency: "weekly", priority: 0.6 });
    for (const g of guides) pages.push({ url: `${base}/guides/${g.slug}`, lastModified: new Date(g.updated_at), changeFrequency: "monthly", priority: 0.6 });
  }
  if (!isSupabaseConfigured()) return bothLanguages(pages);

  const db = createAdminClient();
  const [contests, entries] = await Promise.all([
    db
      .from("contests")
      .select("slug, updated_at, status")
      .in("status", PUBLIC_CONTEST_STATUSES)
      .eq("is_private", false)
      .eq("is_nda", false)
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

  const latest = new Map<string, string>();
  for (const e of entries.data ?? []) if (!latest.has(e.designer_id as string)) latest.set(e.designer_id as string, e.created_at as string);
  const { data: designers } = latest.size
    ? await db.from("profiles").select("id, username").in("id", [...latest.keys()]).eq("role", "designer").eq("status", "active").not("username", "is", null)
    : { data: [] };

  return bothLanguages([
    ...pages,
    ...(contests.data ?? []).map((c) => ({
      url: `${base}/contest/${c.slug}`,
      lastModified: new Date(c.updated_at as string),
      changeFrequency: (c.status === "open" ? "daily" : "monthly") as "daily" | "monthly",
      priority: c.status === "open" ? 0.8 : 0.5,
    })),
    ...(designers ?? []).map((d) => ({ url: `${base}/d/${d.username}`, lastModified: new Date(latest.get(d.id as string)!), changeFrequency: "weekly" as const, priority: 0.5 })),
  ]);
}
