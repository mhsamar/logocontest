import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/admin/core";
import { countedDesigners, guaranteeState, isClaimStatus, needsBkashNumber, refundRoutes, routeAmounts, suggestedRefundNumber, type ClaimStatus, type CountEntry, type GuaranteeState, type PaidLine, type RefundRoute, type RouteAmount } from "./rules";

/**
 * Money-back guarantee reads (owner, 2026-10-21; BLUEPRINT §7.10). Before migration 0069 runs, every read finds
 * nothing (the column and table are missing) and the screens stay as they were.
 */

const db = () => createAdminClient();

type ClaimRow = {
  id: string;
  contest_id: string | null;
  client_id: string | null;
  contest_number: number | null;
  brand_name: string;
  status: string;
  late: boolean;
  disputed: boolean;
  min_designers: number;
  designers_at_claim: number;
  designer_ids_at_claim: string[];
  designers_at_decision: number | null;
  excluded: { designer_id: string; reason: string }[];
  amount: number;
  usd_cents: number;
  payments: PaidLine[];
  refund_to: string | null;
  client_note: string | null;
  reply: string | null;
  internal_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  paying_by: string | null;
  paying_since: string | null;
  refund_refs: Record<string, string>;
  refund_ref: string | null;
  refunded_by: string | null;
  refunded_at: string | null;
  created_at: string;
};

/** What the client sees of their claim. */
export type ClientClaim = { status: ClaimStatus; late: boolean; disputed: boolean; amount: number; usdCents: number; refundTo: string | null; reply: string | null; createdAt: Date; decidedAt: Date | null; refundedAt: Date | null; refundRef: string | null; routes: RouteAmount[] };

export type ContestGuarantee = {
  state: GuaranteeState;
  claim: ClientClaim | null;
  /** What would go back now, and how. */
  amount: number;
  usdCents: number;
  needsNumber: boolean;
  suggestedNumber: string | null;
  /** How the money would go back: bKash, card (Stripe), the automatic gateway, or nothing (QA). */
  routes: RouteAmount[];
  /** Designs still waiting for the team's check (they count once decided). */
  held: number;
};

const NONE: ContestGuarantee = { state: { kind: "none" }, claim: null, amount: 0, usdCents: 0, needsNumber: false, suggestedNumber: null, routes: [], held: 0 };

const toClientClaim = (r: ClaimRow): ClientClaim => ({
  status: r.status as ClaimStatus,
  late: r.late,
  disputed: r.disputed,
  amount: r.amount,
  usdCents: r.usd_cents,
  refundTo: r.refund_to,
  reply: r.reply,
  createdAt: new Date(r.created_at),
  decidedAt: r.decided_at ? new Date(r.decided_at) : null,
  refundedAt: r.refunded_at ? new Date(r.refunded_at) : null,
  refundRef: r.refund_ref,
  routes: routeAmounts((r.payments ?? []) as PaidLine[]),
});

/** The paid lines of a contest right now (guarantee_paid, 0069). */
async function paidNow(contestId: string): Promise<{ amount: number; usdCents: number; lines: PaidLine[] }> {
  const { data } = await db().rpc("guarantee_paid", { p_contest_id: contestId });
  const row = one(data as { amount: number; usd_cents: number; lines: PaidLine[] } | { amount: number; usd_cents: number; lines: PaidLine[] }[] | null);
  return { amount: row?.amount ?? 0, usdCents: row?.usd_cents ?? 0, lines: row?.lines ?? [] };
}

/** Entries of a contest as the counting rule needs them. */
async function countEntries(contestId: string): Promise<CountEntry[]> {
  const { data } = await db().from("entries").select("designer_id, status, rejected_at, designer:profiles!designer_id(is_test)").eq("contest_id", contestId);
  return (data ?? []).map((e) => ({ designerId: e.designer_id as string, status: e.status as string, rejected: Boolean(e.rejected_at), designerIsTest: Boolean(one(e.designer as { is_test: boolean } | { is_test: boolean }[] | null)?.is_test) }));
}

/** The guarantee on the client's contest page: can they claim, and what happened to their claim. */
export async function contestGuarantee(contestId: string, now = new Date()): Promise<ContestGuarantee> {
  if (!isSupabaseConfigured()) return NONE;
  const { data: c, error } = await db()
    .from("contests")
    .select("id, status, guarantee_designers, judging_ends_at, completed_at, admin_review, client:profiles!client_id(is_test)")
    .eq("id", contestId)
    .maybeSingle();
  if (error || !c || !c.guarantee_designers) return NONE;
  const [{ data: claimRow }, handover, paid, wallet, entries, s] = await Promise.all([
    db().from("guarantee_claims").select("*").eq("contest_id", contestId).maybeSingle(),
    db().from("handovers").select("id", { count: "exact", head: true }).eq("contest_id", contestId),
    db().from("payments").select("id", { count: "exact", head: true }).eq("contest_id", contestId).eq("purpose", "contest").eq("status", "paid"),
    db().from("wallet_transactions").select("id", { count: "exact", head: true }).eq("contest_id", contestId),
    countEntries(contestId),
    getSettings(["guarantee.late_days"]),
  ]);
  const claim = claimRow && isClaimStatus(claimRow.status) ? (claimRow as ClaimRow) : null;
  const testContest = Boolean(one(c.client as { is_test: boolean } | { is_test: boolean }[] | null)?.is_test);
  const designers = countedDesigners(entries, { withHeld: false, testContest }).length;
  const state = guaranteeState(
    {
      status: c.status as string,
      guaranteeDesigners: c.guarantee_designers as number,
      judgingEndsAt: c.judging_ends_at ? new Date(c.judging_ends_at as string) : null,
      completedAt: c.completed_at ? new Date(c.completed_at as string) : null,
      adminReview: Boolean(c.admin_review),
      hadHandover: (handover.count ?? 0) > 0,
      contestPaid: (paid.count ?? 0) > 0,
      hadPayout: (wallet.count ?? 0) > 0,
    },
    designers,
    claim ? (claim.status as ClaimStatus) : null,
    now,
    s["guarantee.late_days"],
  );
  const held = entries.filter((e) => e.status === "held").length;
  if (state.kind !== "available" && state.kind !== "check") return { ...NONE, state, held, claim: claim ? toClientClaim(claim) : null };
  const money = await paidNow(contestId);
  return { state, claim: null, amount: money.amount, usdCents: money.usdCents, needsNumber: needsBkashNumber(money.lines), suggestedNumber: suggestedRefundNumber(money.lines), routes: routeAmounts(money.lines), held };
}

/** The number of designers a contest's guarantee promises, or null (none, or before migration 0069). */
export async function contestPromise(contestId: string): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await db().from("contests").select("guarantee_designers").eq("id", contestId).maybeSingle();
  return error ? null : ((data?.guarantee_designers as number | null) ?? null);
}

/** Contests whose claim waits (the lifecycle job leaves them alone). */
export async function pendingClaimContestIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();
  const { data } = await db().from("guarantee_claims").select("contest_id").eq("status", "pending");
  return new Set((data ?? []).map((r) => r.contest_id as string).filter(Boolean));
}

/** Claims the team still has to act on (the admin menu's badge): waiting for a decision, or approved and not paid. */
export async function openClaimCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await db().from("guarantee_claims").select("id", { count: "exact", head: true }).in("status", ["pending", "approved"]);
  return count ?? 0;
}

/** The claim status of each of these contests (for lists that show "Money back"). */
export async function claimStatuses(contestIds: string[]): Promise<Map<string, ClaimStatus>> {
  if (!isSupabaseConfigured() || !contestIds.length) return new Map();
  const { data } = await db().from("guarantee_claims").select("contest_id, status").in("contest_id", contestIds);
  return new Map((data ?? []).filter((r) => r.contest_id && isClaimStatus(r.status)).map((r) => [r.contest_id as string, r.status as ClaimStatus]));
}

/**
 * Money the client got back (approved or sent): left out of what they "spent". Only for contests whose payments are
 * still counted (`counted`: the contests the caller summed; by default every contest not yet erased).
 */
export async function refundedTotal(clientId: string, counted?: Set<string>): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { data } = await db().from("guarantee_claims").select("contest_id, amount").eq("client_id", clientId).in("status", ["approved", "refunded"]);
  return (data ?? []).filter((r) => r.contest_id && (!counted || counted.has(r.contest_id as string))).reduce((s, r) => s + ((r.amount as number) ?? 0), 0);
}

/** Payment ids that were (or are being) given back, for the money reports. */
export async function refundedPaymentIds(): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();
  const { data } = await db().from("guarantee_claims").select("payments").in("status", ["approved", "refunded"]);
  return new Set((data ?? []).flatMap((r) => ((r.payments as PaidLine[] | null) ?? []).map((l) => l.id)));
}

/** Money sent back in a period (by the day it was sent): for the dashboard's money. */
export async function refundsIn(since: string, until: string): Promise<{ count: number; amount: number; fees: number; extras: number }> {
  const out = { count: 0, amount: 0, fees: 0, extras: 0 };
  if (!isSupabaseConfigured()) return out;
  // An erased contest's payments are gone from the totals, so its refund is left out too.
  const { data } = await db().from("guarantee_claims").select("amount, fee_amount, extras_amount").eq("status", "refunded").not("contest_id", "is", null).gte("refunded_at", since).lt("refunded_at", until);
  for (const r of data ?? []) {
    out.count += 1;
    out.amount += (r.amount as number) ?? 0;
    out.fees += (r.fee_amount as number) ?? 0;
    out.extras += (r.extras_amount as number) ?? 0;
  }
  return out;
}

// ---- Admin › Money-back claims ------------------------------------------------------------------------------------

export const CLAIM_TABS = ["pending", "approved", "refunded", "rejected"] as const;
export type ClaimTab = (typeof CLAIM_TABS)[number];

export type AdminClaimEntry = { number: number; designerId: string; designer: string; status: string; rejected: boolean; counted: boolean; rating: number | null; shortlisted: boolean; ip: string | null; withdrawnAt: Date | null };

export type AdminClaim = {
  id: string;
  status: ClaimStatus;
  late: boolean;
  disputed: boolean;
  contest: { id: string; slug: string; number: number | null; brand: string; status: string; judgingEndsAt: Date | null; month: string | null } | null;
  brand: string;
  number: number | null;
  client: { id: string; name: string; mobile: string | null; isTest: boolean } | null;
  min: number;
  atClaim: number;
  atDecision: number | null;
  /** Counted now, held designs included (what approving checks). */
  now: number;
  counted: string[];
  excluded: { designer_id: string; reason: string }[];
  entries: AdminClaimEntry[];
  held: number;
  openReports: number;
  waitingPayments: { amount: number; txn: string }[];
  /** Pro chat between the client and these designers: messages, and how many had a phone, link or payment words or a file. */
  chat: { messages: number; flagged: number; files: number };
  /** The client's other claims in the last year. */
  earlier: number;
  /** The client won a monthly prize for the contest's month. */
  monthlyPrize: boolean;
  /** Counted designers who sent designs from the same internet address. */
  sharedIp: string[][];
  amount: number;
  usdCents: number;
  routes: RefundRoute[];
  lines: PaidLine[];
  refundTo: string | null;
  /** The number the bKash money came from, when the refund number is different. */
  paidFrom: string | null;
  clientNote: string | null;
  reply: string | null;
  internalNote: string | null;
  decidedBy: string | null;
  decidedById: string | null;
  decidedAt: Date | null;
  payingBy: string | null;
  payingById: string | null;
  payingSince: Date | null;
  refundRefs: Record<string, string>;
  refundedBy: string | null;
  refundedAt: Date | null;
  createdAt: Date;
};

const monthOf = (d: string | null) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(new Date(d)) : null);

/** One tab of Admin › Money-back claims, oldest first while waiting, newest first after. */
export async function adminClaims(tab: ClaimTab): Promise<AdminClaim[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await db()
    .from("guarantee_claims")
    .select("*")
    .eq("status", tab)
    .order("created_at", { ascending: tab === "pending" || tab === "approved" })
    .limit(100);
  if (error || !data?.length) return [];
  const rows = data as ClaimRow[];
  const contestIds = rows.map((r) => r.contest_id).filter((x): x is string => Boolean(x));
  const clientIds = rows.map((r) => r.client_id).filter((x): x is string => Boolean(x));
  const staffIds = rows.flatMap((r) => [r.decided_by, r.paying_by, r.refunded_by]).filter((x): x is string => Boolean(x));
  const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const [contests, people, entries, reports, waiting, chats, earlier, prizes] = await Promise.all([
    contestIds.length ? db().from("contests").select("id, slug, contest_number, brand_name, status, judging_ends_at, starts_at").in("id", contestIds) : { data: [] },
    clientIds.length + staffIds.length ? db().from("profiles").select("id, name, mobile, is_test").in("id", [...new Set([...clientIds, ...staffIds])]) : { data: [] },
    contestIds.length
      ? db().from("entries").select("id, contest_id, number, designer_id, status, rejected_at, rating, is_shortlisted, declared_ip, withdrawn_at, designer:profiles!designer_id(name, username, is_test)").in("contest_id", contestIds).order("number")
      : { data: [] },
    contestIds.length ? db().from("reports").select("entry:entries!entry_id(contest_id)").eq("status", "open") : { data: [] },
    contestIds.length ? db().from("manual_payments").select("contest_id, amount, txn_id").eq("status", "pending").in("contest_id", contestIds) : { data: [] },
    contestIds.length ? db().from("contest_messages").select("contest_id, flags, file_path").in("contest_id", contestIds).limit(5000) : { data: [] },
    clientIds.length ? db().from("guarantee_claims").select("id, client_id").in("client_id", clientIds).gte("created_at", yearAgo) : { data: [] },
    clientIds.length ? db().from("monthly_rewards").select("winner_id, month").in("winner_id", clientIds).eq("is_test", false) : { data: [] },
  ]);
  const contestById = new Map((contests.data ?? []).map((c) => [c.id as string, c]));
  const personById = new Map((people.data ?? []).map((p) => [p.id as string, p]));
  const name = (id: string | null) => (id ? ((personById.get(id)?.name as string | undefined) ?? "—") : null);
  const clientTest = (id: string | null) => Boolean(id && personById.get(id)?.is_test);

  return rows.map((r) => {
    const c = r.contest_id ? contestById.get(r.contest_id) : undefined;
    const testContest = clientTest(r.client_id);
    const list = (entries.data ?? []).filter((e) => e.contest_id === r.contest_id);
    const countable: CountEntry[] = list.map((e) => ({ designerId: e.designer_id as string, status: e.status as string, rejected: Boolean(e.rejected_at), designerIsTest: Boolean(one(e.designer as { is_test: boolean } | { is_test: boolean }[] | null)?.is_test) }));
    const counted = countedDesigners(countable, { withHeld: true, testContest });
    const shown: AdminClaimEntry[] = list.map((e, i) => {
      const d = one(e.designer as { name: string; username: string | null } | { name: string; username: string | null }[] | null);
      return {
        number: e.number as number,
        designerId: e.designer_id as string,
        designer: d?.username ? `@${d.username}` : (d?.name ?? "—"),
        status: e.status as string,
        rejected: Boolean(e.rejected_at),
        counted: countedDesigners([countable[i]], { withHeld: true, testContest }).length > 0,
        rating: (e.rating as number | null) ?? null,
        shortlisted: Boolean(e.is_shortlisted),
        ip: (e.declared_ip as string | null) ?? null,
        withdrawnAt: e.withdrawn_at ? new Date(e.withdrawn_at as string) : null,
      };
    });
    // Counted designers who sent from the same address: maybe one person with two accounts.
    const byIp = new Map<string, Set<string>>();
    for (const e of shown) if (e.ip && counted.includes(e.designerId)) byIp.set(e.ip, (byIp.get(e.ip) ?? new Set()).add(e.designer));
    const sharedIp = [...byIp.values()].filter((s) => s.size > 1).map((s) => [...s]);
    const msgs = (chats.data ?? []).filter((m) => m.contest_id === r.contest_id);
    const lines = (r.payments ?? []) as PaidLine[];
    const paidFrom = lines.find((l) => !l.qa && l.sender)?.sender ?? null;
    const month = monthOf((c?.starts_at as string | null) ?? null);
    return {
      id: r.id,
      status: r.status as ClaimStatus,
      late: r.late,
      disputed: r.disputed,
      contest: c ? { id: c.id as string, slug: c.slug as string, number: (c.contest_number as number | null) ?? null, brand: c.brand_name as string, status: c.status as string, judgingEndsAt: c.judging_ends_at ? new Date(c.judging_ends_at as string) : null, month } : null,
      brand: r.brand_name,
      number: r.contest_number,
      client: r.client_id ? { id: r.client_id, name: name(r.client_id) ?? "—", mobile: (personById.get(r.client_id)?.mobile as string | null) ?? null, isTest: testContest } : null,
      min: r.min_designers,
      atClaim: r.designers_at_claim,
      atDecision: r.designers_at_decision,
      now: counted.length,
      counted,
      excluded: r.excluded ?? [],
      entries: shown,
      held: shown.filter((e) => e.status === "held").length,
      openReports: (reports.data ?? []).filter((x) => one(x.entry as { contest_id: string } | { contest_id: string }[] | null)?.contest_id === r.contest_id).length,
      waitingPayments: (waiting.data ?? []).filter((w) => w.contest_id === r.contest_id).map((w) => ({ amount: w.amount as number, txn: w.txn_id as string })),
      chat: { messages: msgs.length, flagged: msgs.filter((m) => ((m.flags as string[] | null) ?? []).length > 0).length, files: msgs.filter((m) => m.file_path).length },
      earlier: (earlier.data ?? []).filter((x) => x.client_id === r.client_id && x.id !== r.id).length,
      monthlyPrize: Boolean(month && (prizes.data ?? []).some((p) => p.winner_id === r.client_id && p.month === month)),
      sharedIp,
      amount: r.amount,
      usdCents: r.usd_cents,
      routes: refundRoutes(lines),
      lines,
      refundTo: r.refund_to,
      paidFrom: paidFrom && r.refund_to && paidFrom.replace(/^\+?88/, "") !== r.refund_to.replace(/^\+?88/, "") ? paidFrom : null,
      clientNote: r.client_note,
      reply: r.reply,
      internalNote: r.internal_note,
      decidedBy: name(r.decided_by),
      decidedById: r.decided_by,
      decidedAt: r.decided_at ? new Date(r.decided_at) : null,
      payingBy: name(r.paying_by),
      payingById: r.paying_by,
      payingSince: r.paying_since ? new Date(r.paying_since) : null,
      refundRefs: r.refund_refs ?? {},
      refundedBy: name(r.refunded_by),
      refundedAt: r.refunded_at ? new Date(r.refunded_at) : null,
      createdAt: new Date(r.created_at),
    };
  });
}

/** How many claims each tab has. */
export async function claimCounts(): Promise<Record<ClaimTab, number>> {
  const out: Record<ClaimTab, number> = { pending: 0, approved: 0, refunded: 0, rejected: 0 };
  if (!isSupabaseConfigured()) return out;
  const { data } = await db().from("guarantee_claims").select("status").limit(10000);
  for (const r of data ?? []) if (isClaimStatus(r.status)) out[r.status as ClaimTab]++;
  return out;
}

/** One claim for the server actions: its row and the contest's brand, slug and client. */
export async function claimForAction(id: string): Promise<(ClaimRow & { slug: string | null }) | null> {
  const { data } = await db().from("guarantee_claims").select("*, contest:contests!contest_id(slug)").eq("id", id).maybeSingle();
  if (!data) return null;
  return { ...(data as ClaimRow), slug: one(data.contest as { slug: string } | { slug: string }[] | null)?.slug ?? null };
}

/** The designers counted for this contest now, held designs included (what the team may leave out). */
export async function countedNow(contestId: string, clientIsTest: boolean): Promise<string[]> {
  return countedDesigners(await countEntries(contestId), { withHeld: true, testContest: clientIsTest });
}
