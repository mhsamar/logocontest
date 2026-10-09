import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/env";
import { LEGAL_SLUGS } from "@/lib/legal/types";
import { searchIndexingOn, siteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";

// Rebuilt at most once an hour.
export const revalidate = 3600;

const PUBLIC_CONTEST_STATUSES = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

/** /sitemap.xml (BLUEPRINT §15.1): public pages, public contests and designer profiles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!searchIndexingOn()) return [];
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/contests`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/design-studio`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/winners`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/how-it-works?for=designers`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/designers/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.5 },
    ...LEGAL_SLUGS.map((slug) => ({ url: `${base}/legal/${slug}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
  if (!isSupabaseConfigured()) return pages;

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

  return [
    ...pages,
    ...(contests.data ?? []).map((c) => ({
      url: `${base}/contest/${c.slug}`,
      lastModified: new Date(c.updated_at as string),
      changeFrequency: (c.status === "open" ? "daily" : "monthly") as "daily" | "monthly",
      priority: c.status === "open" ? 0.8 : 0.5,
    })),
    ...(designers ?? []).map((d) => ({ url: `${base}/d/${d.username}`, lastModified: new Date(latest.get(d.id as string)!), changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
