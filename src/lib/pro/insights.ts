import "server-only";
import { GONE_STATUSES } from "@/lib/entries/rules";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { designerStatsBulk } from "./stats";

const db = () => createAdminClient();
const DAY = 86_400_000;
const DHAKA = 6 * 3_600_000;

export type Insights = {
  days: number;
  designViews: number;
  profileViews: number;
  total: number;
  change: number | null;
  shortlists: number;
  wins: number;
  winRate: number;
  rating: number | null;
  replyMinutes: number | null;
  perDay: { day: string; design: number; profile: number }[];
  funnel: { views: number; opened: number; rated: number; shortlisted: number; won: number };
  sources: { source: string; count: number }[];
  /** heat[weekday 0=Sat..6=Fri][2-hour slot 0..11] */
  heat: number[][];
  bestSlot: number | null;
  top: { id: string; brand: string; number: number; slug: string; views: number; shortlisted: boolean; won: boolean; rating: number | null; thumb: string | null }[];
};

/**
 * A Pro designer's private insights for the last 7, 30 or 90 days (owner, 2026-10-13; Design/pro/pro-insights.html).
 * Design views come from entry_views, profile views from page views of the designer's profile pages. Real data only.
 */
export async function proInsights(designerId: string, username: string | null, days: 7 | 30 | 90, now: Date = new Date()): Promise<Insights> {
  const from = new Date(now.getTime() - days * DAY);
  const before = new Date(from.getTime() - days * DAY);
  const paths = username ? [`/d/${username}`, `/designer/${username}`] : ["/__none__"];
  const [{ data: views }, { data: prevViews }, { data: pviews }, { count: prevProfile }, { data: entries }, { count: wins }, stats] = await Promise.all([
    db().from("entry_views").select("entry_id, by_client, source, created_at").eq("designer_id", designerId).gte("created_at", from.toISOString()).limit(50000),
    db().from("entry_views").select("id").eq("designer_id", designerId).gte("created_at", before.toISOString()).lt("created_at", from.toISOString()).limit(50000),
    db().from("page_views").select("created_at").in("path", paths).gte("created_at", from.toISOString()).limit(50000),
    db().from("page_views").select("id", { count: "exact", head: true }).in("path", paths).gte("created_at", before.toISOString()).lt("created_at", from.toISOString()),
    db()
      .from("entries")
      .select("id, number, status, rating, is_shortlisted, created_at, contest:contests!contest_id(slug, brand_name, is_private, is_nda)")
      .eq("designer_id", designerId)
      .not("status", "in", `(${GONE_STATUSES.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(1000),
    db().from("handovers").select("id", { count: "exact", head: true }).eq("designer_id", designerId).neq("status", "cancelled").gte("created_at", from.toISOString()),
    designerStatsBulk([designerId]),
  ]);
  const s = stats.get(designerId)!;
  const ev = views ?? [];
  const pv = pviews ?? [];
  const total = ev.length + pv.length;
  const prevTotal = (prevViews?.length ?? 0) + (prevProfile ?? 0);

  // Per day (Bangladesh dates).
  const key = (iso: string) => new Date(new Date(iso).getTime() + DHAKA).toISOString().slice(0, 10);
  const perDayMap = new Map<string, { design: number; profile: number }>();
  for (let i = days - 1; i >= 0; i--) perDayMap.set(key(new Date(now.getTime() - i * DAY).toISOString()), { design: 0, profile: 0 });
  for (const v of ev) {
    const d = perDayMap.get(key(v.created_at as string));
    if (d) d.design++;
  }
  for (const v of pv) {
    const d = perDayMap.get(key(v.created_at as string));
    if (d) d.profile++;
  }

  // When people look: weekday × 2-hour slot (Saturday first, as in Bangladesh).
  const heat = Array.from({ length: 7 }, () => Array(12).fill(0) as number[]);
  for (const v of [...ev, ...pv]) {
    const local = new Date(new Date(v.created_at as string).getTime() + DHAKA);
    const wd = (local.getUTCDay() + 1) % 7;
    heat[wd][Math.floor(local.getUTCHours() / 2)]++;
  }
  const slotTotals = Array.from({ length: 12 }, (_, i) => heat.reduce((a, row) => a + row[i], 0));
  const best = Math.max(...slotTotals);

  const sources = new Map<string, number>();
  for (const v of ev) sources.set(v.source as string, (sources.get(v.source as string) ?? 0) + 1);
  if (pv.length) sources.set("profile", (sources.get("profile") ?? 0) + pv.length);

  // Designs: those viewed in the range, most viewed first.
  const viewsBy = new Map<string, number>();
  for (const v of ev) viewsBy.set(v.entry_id as string, (viewsBy.get(v.entry_id as string) ?? 0) + 1);
  const all = (entries ?? []).map((e) => {
    const c = (Array.isArray(e.contest) ? e.contest[0] : e.contest) as { slug: string; brand_name: string; is_private: boolean; is_nda: boolean } | null;
    return { id: e.id as string, number: e.number as number, slug: c?.slug ?? "", brand: c ? (c.is_private || c.is_nda ? "" : c.brand_name) : "", won: e.status === "winner", shortlisted: Boolean(e.is_shortlisted), rating: (e.rating as number | null) ?? null, created: e.created_at as string };
  });
  const top = all
    .filter((e) => viewsBy.has(e.id))
    .sort((a, b) => (viewsBy.get(b.id) ?? 0) - (viewsBy.get(a.id) ?? 0))
    .slice(0, 5);
  const { data: imgs } = top.length ? await db().from("entry_images").select("entry_id, preview_path, position").in("entry_id", top.map((x) => x.id)).order("position") : { data: [] };
  const firstImg = new Map<string, string>();
  for (const i of imgs ?? []) if (!firstImg.has(i.entry_id as string)) firstImg.set(i.entry_id as string, i.preview_path as string);
  const urls = firstImg.size ? await getFileStorage().createReadUrls("entry-files", [...firstImg.values()], 3600).catch(() => new Map<string, string>()) : new Map<string, string>();

  const inRange = all.filter((e) => e.created >= from.toISOString());
  return {
    days,
    designViews: ev.length,
    profileViews: pv.length,
    total,
    change: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    shortlists: inRange.filter((e) => e.shortlisted).length,
    wins: wins ?? 0,
    winRate: s.winRate,
    rating: s.rating,
    replyMinutes: s.replyMinutes,
    perDay: [...perDayMap.entries()].map(([day, v]) => ({ day, ...v })),
    funnel: {
      views: ev.length,
      opened: ev.filter((v) => v.by_client).length,
      rated: inRange.filter((e) => (e.rating ?? 0) >= 4).length,
      shortlisted: inRange.filter((e) => e.shortlisted).length,
      won: inRange.filter((e) => e.won).length,
    },
    sources: [...sources.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    heat,
    bestSlot: best > 0 ? slotTotals.indexOf(best) : null,
    top: top.map((e) => ({ id: e.id, brand: e.brand, number: e.number, slug: e.slug, views: viewsBy.get(e.id) ?? 0, shortlisted: e.shortlisted, won: e.won, rating: e.rating, thumb: urls.get(firstImg.get(e.id) ?? "") ?? null })),
  };
}
