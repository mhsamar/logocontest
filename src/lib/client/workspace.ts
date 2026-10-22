import "server-only";
import { cache } from "react";
import type { CurrentUser } from "@/lib/auth/policies";
import { getClientDashboard, type DashboardContest } from "@/lib/contests/dashboard";
import { ENTRY_FILES_BUCKET, leadingDesigns, listEntries, type EntryCard } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { claimStatuses } from "@/lib/guarantee/queries";
import { badgesFor } from "@/lib/logo-check/entry-links";
import type { Badge } from "@/lib/logo-check/entry-rules";
import { contestChecks } from "@/lib/logo-check/queries";
import { awaitingApproval } from "@/lib/payments/manual";
import { chattableEntries, chatThreads, unreadChats, type ChatThread } from "@/lib/pro/chat";
import { getProSettings } from "@/lib/pro/settings";
import { badgeIdsAmong, proIdsAmong, trialIdsAmong } from "@/lib/pro/status";
import { avatarUrl } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionRank, contestHref, type MenuCounts } from "./rules";

/**
 * Data for the premium client workspace (owner, 2026-10-16; Design/client-premium). Everything comes from the existing
 * queries (contests, entries, payments, logo checks, chats, handovers); nothing here changes them.
 */

const db = () => createAdminClient();
const LIVE = ["open", "judging"];
const HELD = ["open", "judging", "winner_selected", "handover"];

/** One read of the client's contests per request, shared by the shell and the page. */
export const clientContests = cache((userId: string) => getClientDashboard(userId));

// ---- The shell: menu counts, avatar, logo checks card ---------------------------------------------------------------

export type ChecksCard = { brand: string; slug: string; left: number; limit: number; free: boolean };

export type ShellData = {
  name: string;
  business: string | null;
  avatarUrl: string | null;
  counts: MenuCounts;
  links: { review?: string; shortlist?: string };
  checks: ChecksCard | null;
};

/** Checks left in the newest running logo contest (the card under the menu and the dashboard ring). */
const activeChecks = cache(async (userId: string): Promise<ChecksCard | null> => {
  const { contests } = await clientContests(userId);
  const live = contests.filter((c) => LIVE.includes(c.status));
  if (!live.length || !isSupabaseConfigured()) return null;
  const { data } = await db().from("contests").select("id, service").in("id", live.map((c) => c.id));
  const logo = new Set((data ?? []).filter((r) => r.service === "logo").map((r) => r.id as string));
  const c = live.find((x) => logo.has(x.id));
  if (!c) return null;
  const st = await contestChecks({ id: c.id, prize: c.prize, logoScan: c.logoScan, status: c.status });
  return { brand: c.brandName, slug: c.slug, left: st.left, limit: st.limit, free: st.access === "free" };
});

export const clientShell = cache(async (user: CurrentUser): Promise<ShellData> => {
  const [{ contests }, unread, checks, prof] = await Promise.all([
    clientContests(user.id),
    unreadChats(user),
    activeChecks(user.id),
    isSupabaseConfigured() ? db().from("profiles").select("business_name, avatar_path").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const live = contests.filter((c) => LIVE.includes(c.status));
  const review = live.reduce((a, c) => a + c.unrated, 0);
  const most = [...live].sort((a, b) => b.unrated - a.unrated)[0];
  const newest = contests.find((c) => [...LIVE, "winner_selected", "handover"].includes(c.status));
  return {
    name: user.name,
    business: (prof.data?.business_name as string | null) ?? null,
    avatarUrl: avatarUrl((prof.data?.avatar_path as string | null) ?? null) ?? user.avatarUrl ?? null,
    counts: { contests: contests.length, review, unread },
    links: {
      review: most && most.unrated > 0 ? contestHref(most.slug, "designs", { filter: "unrated" }) : newest ? contestHref(newest.slug, "designs") : undefined,
      shortlist: newest ? contestHref(newest.slug, "designs", { filter: "shortlisted" }) : undefined,
    },
    checks,
  };
});

// ---- Designs with their Pro marks and logo check badges (dashboard, details, messages) ----------------------------

export type JudgedEntry = EntryCard & { pro: boolean; trial: boolean; showPro: boolean; badge: Badge; chat: boolean };

/** The client's view of one contest's designs: Pro marks as on the old manage page, the check badge, chat allowed. */
export async function judgedEntries(contest: { id: string; ownerId: string; isBlind: boolean; status: string; winnerIsPublic: boolean }, user: CurrentUser): Promise<JudgedEntry[]> {
  const listed = await listEntries(contest.id, { ownerId: contest.ownerId, isBlind: contest.isBlind, canSeeBrief: true, status: contest.status, winnerIsPublic: contest.winnerIsPublic }, user, "newest");
  const ids = listed.map((e) => e.designerId);
  const [pro, shown, trial, badges, { settings }, chat] = await Promise.all([proIdsAmong(ids), badgeIdsAmong(ids), trialIdsAmong(ids), badgesFor(listed), getProSettings(), chattableEntries(contest.id, user)]);
  return listed.map((e) => ({
    ...e,
    pro: pro.has(e.designerId),
    trial: trial.has(e.designerId),
    showPro: settings.features.highlighted_entries && Boolean(e.designer) && shown.has(e.designerId),
    badge: badges.get(e.id) ?? { kind: "none" },
    chat: chat.has(e.id),
  }));
}

// ---- Dashboard ------------------------------------------------------------------------------------------------------

export type HomeTodo = { kind: "pick" | "rate" | "pay" | "files"; brand: string; n: number; href: string; until: Date | null };
export type HomeFile = { brand: string; slug: string; status: string; href: string; cover: string | null };
export type FreshDesign = JudgedEntry & { contestSlug: string; brand: string };

export type ClientHome = {
  contests: DashboardContest[];
  live: DashboardContest[];
  designs: number;
  designsIn: number;
  designers: number;
  proDesigners: number;
  prizeHeld: number;
  unrated: number;
  nextEnd: Date | null;
  todo: HomeTodo[];
  fresh: FreshDesign[];
  threads: ChatThread[];
  checks: ChecksCard | null;
  files: HomeFile[];
  payLinks: Map<string, string>;
  /** Contests whose money-back claim is being checked (owner, 2026-10-21): picking is paused. */
  claiming: string[];
};

/** Where "Finish payment" goes: a bKash payment waiting for approval, else the draft in the wizard. */
export const payHref = (contestId: string, waiting: Map<string, string>) => (waiting.get(contestId) ? `/pay/contest/${waiting.get(contestId)}` : `/start?draft=${contestId}`);

export async function clientHome(user: CurrentUser): Promise<ClientHome> {
  const [{ contests }, threads, checks] = await Promise.all([clientContests(user.id), chatThreads(user), activeChecks(user.id)]);
  const ids = contests.map((c) => c.id);
  const unpaid = contests.filter((c) => c.status === "draft" || c.status === "pending_payment");
  const [entryRows, handovers, waiting, claims] = await Promise.all([
    ids.length && isSupabaseConfigured() ? db().from("entries").select("designer_id").in("contest_id", ids).not("status", "in", "(removed,withdrawn,held)") : Promise.resolve({ data: [] as { designer_id: string }[] }),
    ids.length && isSupabaseConfigured() ? db().from("handovers").select("contest_id, status, created_at").in("contest_id", ids).neq("status", "cancelled").order("created_at", { ascending: false }) : Promise.resolve({ data: [] as { contest_id: string; status: string; created_at: string }[] }),
    unpaid.length ? awaitingApproval(unpaid.map((c) => c.id)) : Promise.resolve(new Map<string, string>()),
    claimStatuses(contests.filter((c) => c.status === "judging").map((c) => c.id)),
  ]);
  const claiming = [...claims].filter(([, s]) => s === "pending").map(([id]) => id);
  const designerIds = [...new Set((entryRows.data ?? []).map((r) => r.designer_id as string))];
  const pro = await proIdsAmong(designerIds);

  const live = contests.filter((c) => [...LIVE, "winner_selected", "handover", "draft", "pending_payment"].includes(c.status)).sort((a, b) => actionRank(a) - actionRank(b) || b.createdAt.getTime() - a.createdAt.getTime());
  const running = contests.filter((c) => LIVE.includes(c.status));
  const unrated = running.reduce((a, c) => a + c.unrated, 0);
  const nextEnd = running.filter((c) => c.status === "open" && c.endsAt).map((c) => c.endsAt!).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const byId = new Map(contests.map((c) => [c.id, c]));
  const todo: HomeTodo[] = [
    ...contests.filter((c) => c.status === "judging" && !claiming.includes(c.id)).map((c) => ({ kind: "pick" as const, brand: c.brandName, n: c.entries, href: contestHref(c.slug, "designs", { sort: "top" }), until: c.judgingEndsAt })),
    ...(unrated > 0 ? [{ kind: "rate" as const, brand: running.find((c) => c.unrated > 0)?.brandName ?? "", n: unrated, href: contestHref([...running].sort((a, b) => b.unrated - a.unrated)[0].slug, "designs", { filter: "unrated" }), until: null }] : []),
    ...unpaid.map((c) => ({ kind: "pay" as const, brand: c.brandName, n: 0, href: payHref(c.id, waiting), until: null })),
    ...(handovers.data ?? [])
      .filter((h) => h.status === "submitted")
      .flatMap((h) => {
        const c = byId.get(h.contest_id as string);
        return c ? [{ kind: "files" as const, brand: c.brandName, n: 0, href: contestHref(c.slug, "payment"), until: null }] : [];
      }),
  ];

  // Fresh designs: the newest from the running contests (owner view: blind and private ones too).
  const freshLists = await Promise.all(
    running.slice(0, 3).map(async (c) => (await judgedEntries({ id: c.id, ownerId: user.id, isBlind: c.isBlind, status: c.status, winnerIsPublic: false }, user)).map((e) => ({ ...e, contestSlug: c.slug, brand: c.brandName }))),
  );
  const fresh = freshLists
    .flat()
    .filter((e) => e.status === "active" || e.status === "winner")
    .sort((a, b) => b.number - a.number)
    .slice(0, 12);

  const files: HomeFile[] = (handovers.data ?? []).slice(0, 4).flatMap((h) => {
    const c = byId.get(h.contest_id as string);
    return c ? [{ brand: c.brandName, slug: c.slug, status: h.status as string, href: contestHref(c.slug, "payment"), cover: c.cover?.url ?? null }] : [];
  });

  return {
    contests,
    live: live.slice(0, 3),
    designs: contests.reduce((a, c) => a + c.entries, 0),
    designsIn: contests.filter((c) => c.entries > 0).length,
    designers: designerIds.length,
    proDesigners: designerIds.filter((d) => pro.has(d)).length,
    prizeHeld: contests.filter((c) => HELD.includes(c.status)).reduce((a, c) => a + c.prize, 0),
    unrated,
    nextEnd,
    todo,
    claiming,
    fresh,
    threads: threads.slice(0, 3),
    checks,
    files,
    payLinks: waiting,
  };
}

// ---- Payments and files (menu pages) -------------------------------------------------------------------------------

export type ClientPayment = { id: string; brand: string; slug: string; purpose: string; method: string; gateway: string; txnId: string | null; amount: number; status: string; at: Date };

export async function clientPayments(userId: string): Promise<ClientPayment[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await db()
    .from("payments")
    .select("id, purpose, method, gateway, gateway_txn_id, amount, status, paid_at, created_at, contest:contests!contest_id(slug, brand_name, status)")
    .eq("client_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).flatMap((p) => {
    const c = (Array.isArray(p.contest) ? p.contest[0] : p.contest) as { slug: string; brand_name: string; status: string } | null;
    if (!c || c.status === "deleted") return [];
    return [
      {
        id: p.id as string,
        brand: c.brand_name,
        slug: c.slug,
        purpose: p.purpose as string,
        method: p.method as string,
        gateway: p.gateway as string,
        txnId: (p.gateway_txn_id as string | null) ?? null,
        amount: p.amount as number,
        status: p.status as string,
        at: new Date((p.paid_at ?? p.created_at) as string),
      },
    ];
  });
}

// ---- One contest: payments, invited Pro designers, and the time-ordered log --------------------------------------

export type ContestPayment = { id: string; purpose: string; method: string; gateway: string; txnId: string | null; amount: number; status: string; paidAt: Date | null; extensionDays: number | null };

export async function contestPayments(contestId: string): Promise<ContestPayment[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await db().from("payments").select("id, purpose, method, gateway, gateway_txn_id, amount, status, paid_at, extension_days").eq("contest_id", contestId).order("created_at", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    purpose: p.purpose as string,
    method: p.method as string,
    gateway: p.gateway as string,
    txnId: (p.gateway_txn_id as string | null) ?? null,
    amount: p.amount as number,
    status: p.status as string,
    paidAt: p.paid_at ? new Date(p.paid_at as string) : null,
    extensionDays: (p.extension_days as number | null) ?? null,
  }));
}

/** Pro designers the client invited to this contest (Pro "Invite designers"). */
export async function invitedCount(contestId: string): Promise<{ n: number; at: Date | null }> {
  if (!isSupabaseConfigured()) return { n: 0, at: null };
  const { data } = await db().from("contest_invites").select("created_at").eq("contest_id", contestId).order("created_at", { ascending: true });
  return { n: data?.length ?? 0, at: data?.[0] ? new Date(data[0].created_at as string) : null };
}

export type ActivityItem = { at: Date; kind: "created" | "paid" | "addon" | "live" | "invited" | "entry" | "ended" | "winner" | "files" | "approved" | "completed"; n?: number; who?: string; amount?: number };

/** Everything that happened, newest first, from the data the site keeps (CLIENT-HANDOFF §4 Activity). */
export function contestActivity(input: {
  createdAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  payments: ContestPayment[];
  invited: { n: number; at: Date | null };
  entries: { number: number; createdAt: Date; designer: string | null }[];
  handover: { pickedAt: Date; submittedAt: Date | null; approvedAt: Date | null; entryNumber: number; designer: string } | null;
  completedAt: Date | null;
  now: Date;
}): ActivityItem[] {
  const out: ActivityItem[] = [{ at: input.createdAt, kind: "created" }];
  for (const p of input.payments) if (p.status === "paid" && p.paidAt) out.push({ at: p.paidAt, kind: p.purpose === "contest" ? "paid" : "addon", amount: p.amount });
  if (input.startsAt && input.startsAt <= input.now) out.push({ at: input.startsAt, kind: "live" });
  if (input.invited.n && input.invited.at) out.push({ at: input.invited.at, kind: "invited", n: input.invited.n });
  for (const e of input.entries) out.push({ at: e.createdAt, kind: "entry", n: e.number, who: e.designer ?? undefined });
  if (input.endsAt && input.endsAt <= input.now && !["draft", "pending_payment", "open"].includes(input.status)) out.push({ at: input.endsAt, kind: "ended" });
  if (input.handover) {
    out.push({ at: input.handover.pickedAt, kind: "winner", n: input.handover.entryNumber, who: input.handover.designer });
    if (input.handover.submittedAt) out.push({ at: input.handover.submittedAt, kind: "files", who: input.handover.designer });
    if (input.handover.approvedAt) out.push({ at: input.handover.approvedAt, kind: "approved" });
  }
  if (input.completedAt) out.push({ at: input.completedAt, kind: "completed" });
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** When each design of a contest was sent (for "last sent" and the activity log). */
export async function entryTimes(contestId: string): Promise<Map<string, Date>> {
  if (!isSupabaseConfigured()) return new Map();
  const { data } = await db().from("entries").select("id, created_at").eq("contest_id", contestId);
  return new Map((data ?? []).map((r) => [r.id as string, new Date(r.created_at as string)]));
}

// ---- The client's profile (owner view and the public /c/ page) ---------------------------------------------------

const PAID = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];

export type ClientProfileData = {
  id: string;
  name: string;
  username: string | null;
  business: string;
  avatarUrl: string | null;
  memberSince: Date;
  verified: boolean;
  hidden: boolean;
  businessType: string | null;
  stats: { contests: number; prizes: number; designers: number; avgPickDays: number | null };
  winners: { slug: string; brand: string; url: string; designer: string; at: Date }[];
  contests: { slug: string; brand: string; prize: number; entries: number; status: string; cover: string | null; businessType: string }[];
};

/** "Show my profile to designers" (migration 0064). Before it runs, every profile counts as shown. */
export async function profileHidden(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { data, error } = await db().from("profiles").select("profile_hidden").eq("id", userId).maybeSingle();
  return !error && Boolean((data as { profile_hidden?: boolean } | null)?.profile_hidden);
}

/**
 * What designers may see about a client (CLIENT-HANDOFF §6): business name, logo, contests and winning logos, and
 * counts. Never phone, email or payment details; private and NDA contests stay out of the lists.
 */
export async function clientProfileData(by: { id?: string; username?: string }): Promise<ClientProfileData | null> {
  if (!isSupabaseConfigured()) return null;
  let q = db().from("profiles").select("id, name, username, business_name, avatar_path, created_at, email_verified_at, status, role");
  q = by.id ? q.eq("id", by.id) : q.eq("username", (by.username ?? "").toLowerCase());
  const { data: p } = await q.maybeSingle();
  if (!p || p.role !== "client" || p.status === "banned" || p.status === "deleted") return null;
  const id = p.id as string;
  const [{ data: rows }, hidden] = await Promise.all([
    db().from("contests").select("id, slug, brand_name, business_type, prize_amount, status, is_private, is_nda, is_blind, winner_is_public, ends_at, starts_at").eq("client_id", id).in("status", PAID).order("starts_at", { ascending: false }),
    profileHidden(id),
  ]);
  const list = rows ?? [];
  const ids = list.map((c) => c.id as string);
  const [entryRows, handovers] = await Promise.all([
    ids.length ? db().from("entries").select("contest_id, designer_id, status").in("contest_id", ids).not("status", "in", "(removed,withdrawn,held)") : Promise.resolve({ data: [] as { contest_id: string; designer_id: string; status: string }[] }),
    ids.length ? db().from("handovers").select("contest_id, entry_id, created_at, status").in("contest_id", ids).neq("status", "cancelled") : Promise.resolve({ data: [] as { contest_id: string; entry_id: string; created_at: string; status: string }[] }),
  ]);
  const publicRows = list.filter((c) => !c.is_private && !c.is_nda);
  const entriesBy = new Map<string, number>();
  for (const e of entryRows.data ?? []) entriesBy.set(e.contest_id as string, (entriesBy.get(e.contest_id as string) ?? 0) + 1);
  const covers = await leadingDesigns(publicRows.map((c) => ({ id: c.id as string, isBlind: c.is_blind as boolean, isPrivate: false, status: c.status as string })));

  // Winning logos: public contests whose winner is picked; a blind contest only once its winner is made public.
  const picked = (handovers.data ?? []).filter((h) => h.status !== "no_result");
  const winnerIds = picked.map((h) => h.entry_id as string);
  const { data: winRows } = winnerIds.length ? await db().from("entries").select("id, contest_id, designer:profiles!designer_id(name, username), images:entry_images!entry_id(position, preview_path)").in("id", winnerIds) : { data: [] };
  const paths = (winRows ?? []).flatMap((w) => {
    const imgs = ((w.images ?? []) as { position: number; preview_path: string }[]).sort((a, b) => a.position - b.position);
    return imgs[0] ? [imgs[0].preview_path] : [];
  });
  const urls = paths.length ? await getFileStorage().createReadUrls(ENTRY_FILES_BUCKET, paths, 3600).catch(() => new Map<string, string>()) : new Map<string, string>();
  const byId = new Map(list.map((c) => [c.id as string, c]));
  const winners = (winRows ?? []).flatMap((w) => {
    const c = byId.get(w.contest_id as string);
    const h = picked.find((x) => x.entry_id === w.id);
    const imgs = ((w.images ?? []) as { position: number; preview_path: string }[]).sort((a, b) => a.position - b.position);
    const url = imgs[0] ? urls.get(imgs[0].preview_path) : undefined;
    const d = (Array.isArray(w.designer) ? w.designer[0] : w.designer) as { name: string; username: string | null } | null;
    if (!c || !url || !h || c.is_private || c.is_nda || (c.is_blind && !c.winner_is_public)) return [];
    return [{ slug: c.slug as string, brand: c.brand_name as string, url, designer: d?.username ? `@${d.username}` : (d?.name ?? ""), at: new Date(h.created_at as string) }];
  });

  const pickDays = picked
    .map((h) => {
      const c = byId.get(h.contest_id as string);
      return c?.ends_at ? (new Date(h.created_at as string).getTime() - new Date(c.ends_at as string).getTime()) / 86_400_000 : null;
    })
    .filter((x): x is number => x !== null && x >= 0);

  return {
    id,
    name: (p.name as string) ?? "",
    username: (p.username as string | null) ?? null,
    business: ((p.business_name as string | null) ?? "").trim() || ((p.name as string) ?? ""),
    avatarUrl: avatarUrl((p.avatar_path as string | null) ?? null),
    memberSince: new Date(p.created_at as string),
    verified: Boolean(p.email_verified_at),
    hidden,
    businessType: (list[0]?.business_type as string | undefined) ?? null,
    stats: {
      contests: list.length,
      prizes: list.filter((c) => ["winner_selected", "handover", "completed"].includes(c.status as string)).reduce((a, c) => a + (c.prize_amount as number), 0),
      designers: new Set((entryRows.data ?? []).map((e) => e.designer_id as string)).size,
      avgPickDays: pickDays.length ? Math.round((pickDays.reduce((a, b) => a + b, 0) / pickDays.length) * 10) / 10 : null,
    },
    winners: winners.sort((a, b) => b.at.getTime() - a.at.getTime()),
    contests: publicRows.map((c) => ({
      slug: c.slug as string,
      brand: c.brand_name as string,
      prize: c.prize_amount as number,
      entries: entriesBy.get(c.id as string) ?? 0,
      status: c.status as string,
      cover: covers.get(c.id as string)?.url ?? null,
      businessType: c.business_type as string,
    })),
  };
}

// ---- Files & certificates (menu page) -----------------------------------------------------------------------------

export type ClientFiles = {
  finals: { slug: string; brand: string; status: string; cover: string | null; at: Date }[];
  certificates: { id: string; number: number; brand: string; slug: string; verdict: string | null; at: Date }[];
};

export async function clientFiles(userId: string): Promise<ClientFiles> {
  const { contests } = await clientContests(userId);
  const ids = contests.map((c) => c.id);
  if (!ids.length || !isSupabaseConfigured()) return { finals: [], certificates: [] };
  const [h, checks] = await Promise.all([
    db().from("handovers").select("contest_id, status, created_at").in("contest_id", ids).neq("status", "cancelled").order("created_at", { ascending: false }),
    db().from("logo_checks").select("id, number, contest_id, verdict, finished_at, created_at").in("contest_id", ids).eq("status", "done").or("source.neq.pre_submit,entry_id.not.is.null").order("created_at", { ascending: false }).limit(100),
  ]);
  const byId = new Map(contests.map((c) => [c.id, c]));
  return {
    finals: (h.data ?? []).flatMap((r) => {
      const c = byId.get(r.contest_id as string);
      return c ? [{ slug: c.slug, brand: c.brandName, status: r.status as string, cover: c.cover?.url ?? null, at: new Date(r.created_at as string) }] : [];
    }),
    certificates: (checks.data ?? []).flatMap((r) => {
      const c = byId.get(r.contest_id as string);
      // Not for a cancelled contest (money back, or cancelled by the team).
      return c && c.status !== "cancelled" ? [{ id: r.id as string, number: r.number as number, brand: c.brandName, slug: c.slug, verdict: (r.verdict as string | null) ?? null, at: new Date((r.finished_at ?? r.created_at) as string) }] : [];
    }),
  };
}
