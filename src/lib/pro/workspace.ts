import "server-only";
import { GONE_STATUSES } from "@/lib/entries/rules";
import type { Locale } from "@/lib/i18n/config";
import { allServices } from "@/lib/services/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { opensToAllAt } from "./rules";
import { getProSettings } from "./settings";

/**
 * Data for the Pro workspace pages (owner, 2026-10-13). Real rows only: a new designer sees zeros and empty lists.
 */

const db = () => createAdminClient();
const DAY = 86_400_000;

export type MiniContest = {
  id: string;
  slug: string;
  brand: string | null;
  prize: number;
  service: string;
  type: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  isPrivate: boolean;
  entries: number;
  /** When everyone else sees it (early access); null when it is already open to all. */
  opensToAll: Date | null;
};

const COLS = "id, slug, brand_name, prize_amount, service, business_type, starts_at, ends_at, status, is_private, is_nda";

async function toMini(rows: Record<string, unknown>[]): Promise<MiniContest[]> {
  const { settings } = await getProSettings();
  const ids = rows.map((r) => r.id as string);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data } = await db().from("entries").select("contest_id").in("contest_id", ids).not("status", "in", `(${GONE_STATUSES.join(",")})`).limit(20000);
    for (const e of data ?? []) counts.set(e.contest_id as string, (counts.get(e.contest_id as string) ?? 0) + 1);
  }
  const now = Date.now();
  return rows.map((r) => {
    const startsAt = r.starts_at ? new Date(r.starts_at as string) : null;
    const all = startsAt ? opensToAllAt(startsAt, settings) : null;
    return {
      id: r.id as string,
      slug: r.slug as string,
      brand: r.is_private || r.is_nda ? null : (r.brand_name as string),
      prize: (r.prize_amount as number) ?? 0,
      service: ((r.service as string | null) ?? "logo") as string,
      type: r.business_type as string,
      startsAt,
      endsAt: r.ends_at ? new Date(r.ends_at as string) : null,
      status: r.status as string,
      isPrivate: Boolean(r.is_private || r.is_nda),
      entries: counts.get(r.id as string) ?? 0,
      opensToAll: all && all.getTime() > now ? all : null,
    };
  });
}

/** Open contests still in their Pro early-access window (newest first). */
export async function earlyContests(): Promise<MiniContest[]> {
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.features.early_access || settings.earlyAccessMinutes <= 0) return [];
  const since = new Date(Date.now() - settings.earlyAccessMinutes * 60_000).toISOString();
  const { data } = await db().from("contests").select(`${COLS}, owner:profiles!client_id!inner(is_test)`).eq("status", "open").eq("owner.is_test", false).gt("starts_at", since).order("starts_at", { ascending: false }).limit(20);
  return toMini((data ?? []) as Record<string, unknown>[]);
}

/** Open contests that started in the last 3 days, newest first (the dashboard's panel while early access is off). */
export async function newContests(limit = 20): Promise<MiniContest[]> {
  const since = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data } = await db().from("contests").select(`${COLS}, owner:profiles!client_id!inner(is_test)`).eq("status", "open").eq("owner.is_test", false).gt("starts_at", since).gt("ends_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(limit);
  return toMini((data ?? []) as Record<string, unknown>[]);
}

/** Every open contest (Pro sees all of them, early ones included), newest first; never a test client's one. */
export async function openContests(limit = 60): Promise<MiniContest[]> {
  const { data } = await db().from("contests").select(`${COLS}, owner:profiles!client_id!inner(is_test)`).eq("status", "open").eq("owner.is_test", false).gt("ends_at", new Date().toISOString()).order("starts_at", { ascending: false }).limit(limit);
  return toMini((data ?? []) as Record<string, unknown>[]);
}

export async function contestsByIdsMini(ids: string[]): Promise<MiniContest[]> {
  if (!ids.length) return [];
  const { data } = await db().from("contests").select(COLS).in("id", ids);
  return toMini((data ?? []) as Record<string, unknown>[]);
}

export async function portfolioCount(designerId: string): Promise<number> {
  const { ready } = await getProSettings();
  if (!ready) return 0;
  const { count } = await db().from("portfolio_items").select("id", { count: "exact", head: true }).eq("designer_id", designerId);
  return count ?? 0;
}

export type InviteStatus = "pending" | "accepted" | "declined";
/** The brief the invited designer may read (owner, 2026-10-14); null for an NDA contest (sign it on the contest page). */
export type InviteBrief = { description: string; logoText: string | null; slogan: string | null; likes: string | null; dislikes: string | null } | null;
export type Invitation = { contest: MiniContest; joined: boolean; createdAt: string; status: InviteStatus; respondedAt: string | null; isNda: boolean; brief: InviteBrief };

/**
 * Contests a client invited this designer to that are still open (owner, 2026-10-14): with the brief, the prize, the
 * deadline and the client's requirements, and whether the designer accepted or declined. Removed ones are left out.
 */
export async function myInvitations(designerId: string): Promise<Invitation[]> {
  const { ready } = await getProSettings();
  if (!ready) return [];
  const { data } = await db()
    .from("contest_invites")
    .select("contest_id, created_at, notified_at, status, responded_at")
    .eq("designer_id", designerId)
    .not("notified_at", "is", null)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(30);
  const ids = (data ?? []).map((r) => r.contest_id as string);
  const contests = (await contestsByIdsMini(ids)).filter((c) => c.status === "open");
  if (!contests.length) return [];
  const [{ data: mine }, { data: briefs }] = await Promise.all([
    db().from("entries").select("contest_id").eq("designer_id", designerId).in("contest_id", contests.map((c) => c.id)),
    db().from("contests").select("id, is_nda, business_description, logo_text, slogan, likes_text, dislikes_text").in("id", contests.map((c) => c.id)),
  ]);
  const joined = new Set((mine ?? []).map((r) => r.contest_id as string));
  const row = new Map((data ?? []).map((r) => [r.contest_id as string, r]));
  const brief = new Map((briefs ?? []).map((b) => [b.id as string, b]));
  return contests
    .map((c) => {
      const r = row.get(c.id);
      const b = brief.get(c.id);
      const nda = Boolean(b?.is_nda);
      return {
        contest: c,
        joined: joined.has(c.id),
        createdAt: (r?.created_at as string) ?? "",
        status: (r?.status as InviteStatus) ?? "pending",
        respondedAt: (r?.responded_at as string | null) ?? null,
        isNda: nda,
        brief:
          b && !nda
            ? {
                description: (b.business_description as string) ?? "",
                logoText: (b.logo_text as string | null) ?? null,
                slogan: (b.slogan as string | null) ?? null,
                likes: (b.likes_text as string | null) ?? null,
                dislikes: (b.dislikes_text as string | null) ?? null,
              }
            : null,
      };
    })
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || (a.createdAt < b.createdAt ? 1 : -1));
}

/** This week's numbers: profile views, design views, shortlisted designs sent this week, wins this week. */
export async function weekNumbers(designerId: string, username: string | null): Promise<{ profileViews: number; designViews: number; shortlists: number; wins: number }> {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const paths = username ? [`/d/${username}`, `/designer/${username}`] : [];
  const [pv, dv, sl, wins] = await Promise.all([
    paths.length ? db().from("page_views").select("id", { count: "exact", head: true }).in("path", paths).gte("created_at", since) : Promise.resolve({ count: 0 }),
    db().from("entry_views").select("id", { count: "exact", head: true }).eq("designer_id", designerId).gte("created_at", since),
    db().from("entries").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("is_shortlisted", true).gte("created_at", since),
    db().from("handovers").select("id", { count: "exact", head: true }).eq("designer_id", designerId).neq("status", "cancelled").gte("created_at", since),
  ]);
  return { profileViews: pv.count ?? 0, designViews: dv.count ?? 0, shortlists: sl.count ?? 0, wins: wins.count ?? 0 };
}

export type MyContestRow = { contest: MiniContest; designs: number; place: "won" | "shortlisted" | "open" | "judging" | "ended" };

/** Contests this designer sent designs to, most recent first. */
export async function myContestRows(designerId: string, limit = 6): Promise<MyContestRow[]> {
  const { data } = await db().from("entries").select("contest_id, status, is_shortlisted, created_at").eq("designer_id", designerId).not("status", "in", `(${GONE_STATUSES.join(",")})`).order("created_at", { ascending: false }).limit(500);
  const by = new Map<string, { designs: number; won: boolean; shortlisted: boolean }>();
  for (const e of data ?? []) {
    const id = e.contest_id as string;
    const r = by.get(id) ?? by.set(id, { designs: 0, won: false, shortlisted: false }).get(id)!;
    r.designs++;
    if (e.status === "winner") r.won = true;
    if (e.is_shortlisted) r.shortlisted = true;
  }
  const ids = [...by.keys()].slice(0, limit);
  const contests = await contestsByIdsMini(ids);
  const byId = new Map(contests.map((c) => [c.id, c]));
  return ids
    .map((id) => {
      const c = byId.get(id);
      if (!c) return null;
      const r = by.get(id)!;
      const place: MyContestRow["place"] = r.won ? "won" : r.shortlisted ? "shortlisted" : c.status === "open" ? "open" : c.status === "judging" ? "judging" : "ended";
      return { contest: c, designs: r.designs, place };
    })
    .filter((x): x is MyContestRow => Boolean(x));
}

export type Strength = { percent: number; photoBio: boolean; featured: boolean; skills: boolean; cover: boolean };

/** Profile strength: photo and bio, pinned featured designs, skills and tools, a cover from the designer's work. */
export async function profileStrength(designerId: string, hasPhoto: boolean): Promise<Strength> {
  const [{ data: p }, { data: pref }] = await Promise.all([
    db().from("profiles").select("bio, skills, tools").eq("id", designerId).maybeSingle(),
    db().from("pro_preferences").select("cover_entry_ids, featured_entry_ids").eq("designer_id", designerId).maybeSingle(),
  ]);
  const photoBio = hasPhoto && Boolean(((p?.bio as string | null) ?? "").trim());
  const featured = ((pref?.featured_entry_ids as string[] | null) ?? []).length > 0;
  const skills = ((p?.skills as string[] | null) ?? []).length > 0 && ((p?.tools as string[] | null) ?? []).length > 0;
  const cover = ((pref?.cover_entry_ids as string[] | null) ?? []).length > 0;
  const done = [photoBio, featured, skills, cover].filter(Boolean).length;
  return { percent: done * 25, photoBio, featured, skills, cover };
}

export type ProPrefs = {
  title: string | null;
  showBadge: boolean;
  clientMessages: boolean;
  weeklyReport: boolean;
  showContact: boolean;
  coverEntryIds: string[];
  featuredEntryIds: string[];
  alertApp: boolean;
  alertServices: string[];
  similarAlerts: boolean;
};

export async function proPrefs(designerId: string): Promise<ProPrefs> {
  const { data } = await db().from("pro_preferences").select("*").eq("designer_id", designerId).maybeSingle();
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    title: (r.title as string | null) ?? null,
    showBadge: r.show_badge !== false,
    clientMessages: r.client_messages !== false,
    weeklyReport: r.weekly_report === true,
    showContact: r.show_contact === true,
    coverEntryIds: (r.cover_entry_ids as string[] | null) ?? [],
    featuredEntryIds: (r.featured_entry_ids as string[] | null) ?? [],
    alertApp: r.alert_app !== false,
    alertServices: (r.alert_services as string[] | null) ?? [],
    similarAlerts: r.similar_alerts !== false,
  };
}

/** Names of the contest services (YouTube thumbnail, …) in the reader's language, for contest lines. */
export async function serviceNames(locale: Locale): Promise<Map<string, string>> {
  const list = await allServices();
  return new Map(list.map((s) => [s.slug, locale === "bn" ? s.name.bn || s.name.en : s.name.en]));
}
