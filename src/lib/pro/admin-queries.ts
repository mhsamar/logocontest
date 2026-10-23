import "server-only";
import { GONE_STATUSES } from "@/lib/entries/rules";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { dhakaMonth, dropPercent, isProActive, percentOf, type FunnelEvent } from "./rules";
import { getProSettings } from "./settings";
import { SUB_COLUMNS, toSubscription, type Subscription } from "./status";

/**
 * Admin › Pro plan reports (owner, 2026-10-13; Design/pro/admin-pro-plan.html). Every number comes from Pro payments,
 * subscriptions and the funnel events; nothing is made up, and an empty plan shows zeros and empty lists.
 */

const db = () => createAdminClient();
const DAY = 86_400_000;

type Ev = { designer_id: string | null; event: FunnelEvent; step: string | null; created_at: string };

export type MemberStatus = "active" | "expiring" | "payment_failed" | "cancelled" | "expired";
export type Member = {
  designerId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  status: MemberStatus;
  since: string;
  renews: string | null;
  winsBefore: number;
  winsAfter: number;
  rateBefore: number;
  rateAfter: number;
  rateChange: number;
  checksUsed: number;
  quality: number | null;
};

export type ProOverview = {
  ready: boolean;
  kpi: { active: number; newThisMonth: number; income: number; incomeChange: number | null; upgradeRate: number; cancelled: number; cancelledShare: number; failed: number; renewRate: number | null };
  funnel: { seen: number; clicked: number; checkout: number; paid: number; renewed: number; drops: [number, number, number, number] };
  whereStop: { closed: number; failed: number; changed: number; cameBack: number; total: number };
  whenStop: { right: number; hour: number; day: number; later: number; total: number };
  clickers: { designerId: string; name: string; username: string | null; avatarUrl: string | null; clickedAt: string; stoppedAt: "closed" | "failed" | "changed" | "clicked"; visits: number; wasPro: boolean }[];
  members: Member[];
  counts: Record<"all" | MemberStatus, number>;
  best: Member[];
  avgBefore: number | null;
  avgAfter3m: number | null;
  reasons: { reason: string; count: number }[];
  cancelDays: string | null;
  avgMonths: number | null;
  activity: { id: number; actor: string | null; action: string; designer: string | null; oldValue: unknown; newValue: unknown; at: string }[];
};

/** A member's status as the admin sees it: "Expiring soon" in the last 7 days of a plan that won't renew by itself. */
export function memberStatus(sub: Subscription, now: Date = new Date()): MemberStatus {
  if (!isProActive(sub, now)) return "expired";
  if (sub.status === "cancelled" || sub.status === "payment_failed") return sub.status;
  return sub.currentPeriodEnd.getTime() - now.getTime() <= 7 * DAY ? "expiring" : "active";
}

const rate = (wins: number, contests: number) => (contests > 0 ? Math.round((Math.min(wins, contests) / contests) * 100) : 0);

export async function proOverview(rangeDays: 7 | 30 | 90, now: Date = new Date(), newSince: Date | null = null): Promise<ProOverview> {
  const { ready } = await getProSettings();
  const empty: ProOverview = {
    ready,
    kpi: { active: 0, newThisMonth: 0, income: 0, incomeChange: null, upgradeRate: 0, cancelled: 0, cancelledShare: 0, failed: 0, renewRate: null },
    funnel: { seen: 0, clicked: 0, checkout: 0, paid: 0, renewed: 0, drops: [0, 0, 0, 0] },
    whereStop: { closed: 0, failed: 0, changed: 0, cameBack: 0, total: 0 },
    whenStop: { right: 0, hour: 0, day: 0, later: 0, total: 0 },
    clickers: [],
    members: [],
    counts: { all: 0, active: 0, expiring: 0, payment_failed: 0, cancelled: 0, expired: 0 },
    best: [],
    avgBefore: null,
    avgAfter3m: null,
    reasons: [],
    cancelDays: null,
    avgMonths: null,
    activity: [],
  };
  if (!ready) return empty;
  const since = new Date(now.getTime() - rangeDays * DAY).toISOString();
  const month = dhakaMonth(now);
  const lastMonth = dhakaMonth(new Date(month.from.getTime() - DAY));

  const [{ data: subRows }, { data: events }, { data: payments }, { data: latest }, { data: sinceVisit }] = await Promise.all([
    db().from("pro_subscriptions").select(`${SUB_COLUMNS}, cancel_note`).limit(5000),
    db().from("pro_funnel_events").select("designer_id, event, step, created_at").gte("created_at", since).order("created_at").limit(50000),
    db().from("pro_payments").select("designer_id, kind, amount_bdt, status, paid_at, created_at").gte("created_at", lastMonth.from.toISOString()).limit(20000),
    db().from("pro_activity_log").select("id, actor_id, action, designer_id, old_value, new_value, created_at").order("created_at", { ascending: false }).limit(12),
    // Every line since the admin last looked (owner, 2026-10-23), so each new payment shows with its "New" tag and the
    // log has no gaps.
    newSince
      ? db().from("pro_activity_log").select("id, actor_id, action, designer_id, old_value, new_value, created_at").gt("created_at", newSince.toISOString()).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const logs = [...new Map([...(latest ?? []), ...(sinceVisit ?? [])].map((l) => [l.id, l])).values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const subs = (subRows ?? []).map((r) => toSubscription(r as Record<string, unknown>));
  const ev = (events ?? []) as Ev[];

  // KPIs
  const statusOf = new Map(subs.map((s) => [s.designerId, memberStatus(s, now)]));
  const live = subs.filter((s) => isProActive(s, now));
  const paidIn = (from: Date, to: Date) => (payments ?? []).filter((p) => p.status === "paid" && p.paid_at && new Date(p.paid_at as string) >= from && new Date(p.paid_at as string) < to).reduce((a, p) => a + ((p.amount_bdt as number) ?? 0), 0);
  const income = paidIn(month.from, month.to);
  const before = paidIn(lastMonth.from, lastMonth.to);
  const cancelledThisMonth = subs.filter((s) => s.cancelledAt && s.cancelledAt >= month.from).length;
  const distinct = (e: FunnelEvent) => new Set(ev.filter((x) => x.event === e).map((x) => x.designer_id ?? `${x.created_at}`)).size;
  const clicked = distinct("upgrade_clicked");
  const paid = distinct("paid");
  const firstEnded = subs.filter((s) => s.firstStartedAt.getTime() + 31 * DAY < now.getTime());
  const { data: renewals } = firstEnded.length ? await db().from("pro_payments").select("designer_id").eq("kind", "renewal").eq("status", "paid").in("designer_id", firstEnded.map((s) => s.designerId)) : { data: [] };
  const renewedSet = new Set((renewals ?? []).map((r) => r.designer_id as string));

  const funnel = { seen: distinct("card_seen"), clicked, checkout: distinct("checkout_opened"), paid, renewed: distinct("renewed") };

  // Where and when they stop: designers who clicked and didn't pay (in the range).
  const byDesigner = new Map<string, Ev[]>();
  for (const e of ev) if (e.designer_id) (byDesigner.get(e.designer_id) ?? byDesigner.set(e.designer_id, []).get(e.designer_id)!).push(e);
  const where = { closed: 0, failed: 0, changed: 0, cameBack: 0, total: 0 };
  const when = { right: 0, hour: 0, day: 0, later: 0, total: 0 };
  const clickers: ProOverview["clickers"] = [];
  for (const [id, list] of byDesigner) {
    const click = list.find((e) => e.event === "upgrade_clicked");
    if (!click) continue;
    const paidEv = list.find((e) => e.event === "paid" && e.created_at >= click.created_at);
    const methods = new Set(list.filter((e) => e.event === "payment_started").map((e) => e.step));
    if (paidEv) {
      if (new Date(paidEv.created_at).getTime() - new Date(click.created_at).getTime() > DAY) {
        where.cameBack++;
        where.total++;
      }
      continue;
    }
    const last = [...list].reverse().find((e) => e.event !== "card_seen" && e.event !== "reminded") ?? click;
    const stoppedAt = last.event === "payment_failed" ? "failed" : methods.size > 1 ? "changed" : last.event === "checkout_closed" || last.event === "checkout_opened" || last.event === "payment_started" ? "closed" : "clicked";
    if (stoppedAt === "failed") where.failed++;
    else if (stoppedAt === "changed") where.changed++;
    else where.closed++;
    where.total++;
    const gap = new Date(last.created_at).getTime() - new Date(click.created_at).getTime();
    if (gap < 5 * 60_000) when.right++;
    else if (gap < 3_600_000) when.hour++;
    else if (gap < DAY) when.day++;
    else when.later++;
    when.total++;
    clickers.push({ designerId: id, name: "", username: null, avatarUrl: null, clickedAt: click.created_at, stoppedAt, visits: list.filter((e) => e.event === "checkout_opened").length, wasPro: statusOf.has(id) });
  }
  clickers.sort((a, b) => (a.clickedAt < b.clickedAt ? 1 : -1));
  // Members still Pro are not "did not buy".
  const notPro = clickers.filter((c) => !live.some((s) => s.designerId === c.designerId));

  // Members with their before → after results.
  const memberIds = subs.map((s) => s.designerId);
  const people = new Map<string, { name: string; username: string | null; avatar: string | null; wins: number }>();
  const peopleIds = [...new Set([...memberIds, ...notPro.slice(0, 50).map((c) => c.designerId), ...((logs ?? []).flatMap((l) => [l.actor_id, l.designer_id]).filter(Boolean) as string[])])];
  if (peopleIds.length) {
    const { data: ps } = await db().from("profiles").select("id, name, username, avatar_path, wins_count").in("id", peopleIds);
    for (const p of ps ?? []) people.set(p.id as string, { name: ((p.name as string) ?? "").trim(), username: (p.username as string | null) ?? null, avatar: avatarUrl(p.avatar_path as string | null), wins: (p.wins_count as number) ?? 0 });
  }
  const [{ data: entryRows }, { data: checkRows }, { data: quality }] = await Promise.all([
    memberIds.length ? db().from("entries").select("designer_id, contest_id, status, created_at").in("designer_id", memberIds).not("status", "in", `(${GONE_STATUSES.join(",")})`).limit(50000) : Promise.resolve({ data: [] }),
    memberIds.length ? db().from("logo_checks").select("requested_by").eq("source", "designer").in("requested_by", memberIds).gte("created_at", month.from.toISOString()).neq("status", "failed").limit(50000) : Promise.resolve({ data: [] }),
    memberIds.length ? db().from("designer_quality_score").select("designer_id, score").in("designer_id", memberIds) : Promise.resolve({ data: [] }),
  ]);
  const checks = new Map<string, number>();
  for (const r of checkRows ?? []) checks.set(r.requested_by as string, (checks.get(r.requested_by as string) ?? 0) + 1);
  const qual = new Map((quality ?? []).map((q) => [q.designer_id as string, q.score as number]));
  const members: Member[] = subs.map((s) => {
    const mine = (entryRows ?? []).filter((e) => e.designer_id === s.designerId);
    const start = s.startedAt.getTime();
    const beforeRows = mine.filter((e) => new Date(e.created_at as string).getTime() < start);
    const afterRows = mine.filter((e) => new Date(e.created_at as string).getTime() >= start);
    const cBefore = new Set(beforeRows.map((e) => e.contest_id)).size;
    const cAfter = new Set(afterRows.map((e) => e.contest_id)).size;
    const wBefore = Math.max(s.winsAtStart, beforeRows.filter((e) => e.status === "winner").length);
    const wAfterOnly = afterRows.filter((e) => e.status === "winner").length;
    const p = people.get(s.designerId);
    const rb = rate(wBefore, cBefore);
    const ra = rate(wAfterOnly, cAfter);
    return {
      designerId: s.designerId,
      name: p?.name ?? "",
      username: p?.username ?? null,
      avatarUrl: p?.avatar ?? null,
      status: memberStatus(s, now),
      since: s.firstStartedAt.toISOString(),
      renews: isProActive(s, now) ? s.currentPeriodEnd.toISOString() : null,
      winsBefore: wBefore,
      winsAfter: wBefore + wAfterOnly,
      rateBefore: rb,
      rateAfter: ra,
      rateChange: cAfter > 0 ? ra - rb : 0,
      checksUsed: checks.get(s.designerId) ?? 0,
      quality: qual.get(s.designerId) ?? null,
    };
  });
  const counts = { all: members.length, active: 0, expiring: 0, payment_failed: 0, cancelled: 0, expired: 0 } as ProOverview["counts"];
  for (const m of members) counts[m.status]++;
  const best = [...members].filter((m) => m.rateChange > 0).sort((a, b) => b.rateChange - a.rateChange).slice(0, 3);
  const withAfter = members.filter((m) => now.getTime() - new Date(m.since).getTime() >= 90 * DAY);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

  // Why they cancel, and when.
  const reasons = new Map<string, number>();
  for (const s of subs) if (s.cancelReason) reasons.set(s.cancelReason, (reasons.get(s.cancelReason) ?? 0) + 1);
  const cancelled = subs.filter((s) => s.cancelledAt);
  const dayBuckets = new Map<string, number>();
  for (const s of cancelled) {
    const d = new Date(s.cancelledAt!.getTime() + 6 * 3_600_000).getUTCDate();
    const b = d <= 7 ? "1–7" : d <= 14 ? "8–14" : d <= 21 ? "15–21" : d <= 24 ? "22–24" : "25–31";
    dayBuckets.set(b, (dayBuckets.get(b) ?? 0) + 1);
  }
  const topDays = [...dayBuckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lengths = subs.map((s) => (Math.min(now.getTime(), s.currentPeriodEnd.getTime()) - s.firstStartedAt.getTime()) / (30 * DAY)).filter((x) => x > 0);

  for (const c of notPro) {
    const p = people.get(c.designerId);
    c.name = p?.name ?? "";
    c.username = p?.username ?? null;
    c.avatarUrl = p?.avatar ?? null;
  }

  return {
    ready,
    kpi: {
      active: live.length,
      newThisMonth: subs.filter((s) => s.firstStartedAt >= month.from).length,
      income,
      incomeChange: before > 0 ? Math.round(((income - before) / before) * 100) : null,
      upgradeRate: clicked > 0 ? Math.round((paid / clicked) * 1000) / 10 : 0,
      cancelled: cancelledThisMonth,
      cancelledShare: percentOf(cancelledThisMonth, live.length + cancelledThisMonth),
      failed: subs.filter((s) => s.status === "payment_failed" && isProActive(s, now)).length,
      renewRate: firstEnded.length ? percentOf(firstEnded.filter((s) => renewedSet.has(s.designerId)).length, firstEnded.length) : null,
    },
    funnel: { ...funnel, drops: [dropPercent(funnel.seen, funnel.clicked), dropPercent(funnel.clicked, funnel.checkout), dropPercent(funnel.checkout, funnel.paid), dropPercent(funnel.paid, funnel.renewed)] },
    whereStop: where,
    whenStop: when,
    clickers: notPro,
    members: members.sort((a, b) => b.rateChange - a.rateChange || (a.renews ?? "").localeCompare(b.renews ?? "")),
    counts,
    best,
    avgBefore: avg(withAfter.map((m) => m.rateBefore)),
    avgAfter3m: avg(withAfter.map((m) => m.rateAfter)),
    reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    cancelDays: topDays,
    avgMonths: lengths.length ? Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 10) / 10 : null,
    activity: (logs ?? []).map((l) => ({
      id: l.id as number,
      actor: l.actor_id ? (people.get(l.actor_id as string)?.name ?? null) : null,
      action: l.action as string,
      designer: l.designer_id ? (people.get(l.designer_id as string)?.name ?? null) : null,
      oldValue: l.old_value,
      newValue: l.new_value,
      at: l.created_at as string,
    })),
  };
}

/** Every activity-log row for the CSV export. */
export async function proActivityExport(): Promise<{ at: string; actor: string; action: string; designer: string; old: string; new: string }[]> {
  const { data } = await db().from("pro_activity_log").select("actor_id, action, designer_id, old_value, new_value, created_at").order("created_at", { ascending: false }).limit(20000);
  const ids = [...new Set((data ?? []).flatMap((r) => [r.actor_id, r.designer_id]).filter(Boolean) as string[])];
  const { data: ps } = ids.length ? await db().from("profiles").select("id, name").in("id", ids) : { data: [] };
  const name = new Map((ps ?? []).map((p) => [p.id as string, ((p.name as string) ?? "").trim()]));
  return (data ?? []).map((r) => ({
    at: r.created_at as string,
    actor: r.actor_id ? (name.get(r.actor_id as string) ?? "") : "System",
    action: r.action as string,
    designer: r.designer_id ? (name.get(r.designer_id as string) ?? "") : "",
    old: r.old_value === null ? "" : JSON.stringify(r.old_value),
    new: r.new_value === null ? "" : JSON.stringify(r.new_value),
  }));
}
