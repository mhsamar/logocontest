/**
 * Admin › Unpaid contests, follow-ups (owner, 2026-10-25; Design/unpaid-contests): the stages people stop at, the
 * status rules, follow-up times, tabs, filters and the address of each view. Pure: shared by the page, the server
 * actions and the tests. Times are Bangladesh time (UTC+6, no summer time).
 */

// ---- Stages ---------------------------------------------------------------------------------------------------------

/**
 * The wizard's 8 screens, then "Went to payment" and "Paid" (admin.dashboard.steps.s1..s10). The design's 13 steps were
 * the old wizard: several of them are one screen now (Styles + Colours, Requirements + Files, Prize + Password).
 */
export const STAGES = 10;
export const AT_PAYMENT = 9;
export const PAID = 10;
/** A saved draft has passed Prize: it exists only once the whole brief and the order are valid. */
export const DRAFT_STAGE = 7;
/** Wizard visits before this used the old numbering: 1 Logo name … 11 Review, 12 Went to payment. */
export const STEPS_CUTOVER = Date.parse("2026-10-15T17:25:34Z");
const OLD_TO_NEW = [1, 2, 3, 4, 5, 5, 6, 6, 7, 7, 7, 8, 9];

/** The stage a wizard visit reached, in today's numbering (1..9; Paid comes from the contest). */
export function stageOf(furthest: number | null | undefined, createdAt: string | Date): number {
  const n = Math.max(1, Math.floor(Number(furthest) || 1));
  const old = new Date(createdAt).getTime() < STEPS_CUTOVER;
  return old ? OLD_TO_NEW[Math.min(n, 12)] : Math.min(n, AT_PAYMENT);
}

export type FunnelStep = { n: number; count: number; drop: number | null };

/** "Where they get stuck": how many visits reached each stage, and how many were lost from the one before. */
export function funnelCounts(visits: { stage: number; paid: boolean }[]): FunnelStep[] {
  const counts = Array.from({ length: STAGES }, (_, i) => (i + 1 === PAID ? visits.filter((v) => v.paid).length : visits.filter((v) => v.paid || v.stage >= i + 1).length));
  return counts.map((count, i) => ({ n: i + 1, count, drop: i === 0 ? null : counts[i - 1] - count }));
}

export type Drop = { from: number; to: number; lost: number; pct: number };

/** The steps where most people leave, worst first (on a tie, the later step). */
export function biggestDrops(funnel: FunnelStep[], n = 2): Drop[] {
  return funnel
    .slice(1)
    .map((s) => ({ from: s.n - 1, to: s.n, lost: s.drop ?? 0, pct: funnel[s.n - 2].count ? Math.round(((s.drop ?? 0) / funnel[s.n - 2].count) * 100) : 0 }))
    .filter((d) => d.lost > 0)
    .sort((a, b) => b.lost - a.lost || b.from - a.from)
    .slice(0, n);
}

// ---- Onboarding v2 --------------------------------------------------------------------------------------------------

/**
 * Where a client of the new 4-step wizard is (owner, 2026-10-29; client-onboarding-v2-spec.md §4): 1 account made, 2 logo
 * name saved (the draft exists from here), 3 saw the prizes or picked a package, 4 opened the payment, then the bKash ID
 * sent (wizardV2.admin.unpaid.steps.*). Read from the contest itself: its wizard visits count the new wizard's own 1–5.
 */
export const V2_STEPS = ["s1", "s2", "s3viewed", "s3picked", "s4", "sent"] as const;
export type V2Step = (typeof V2_STEPS)[number];
/** The steps a lead on the list can be at: a sent bKash ID counts as paid for following up, as with the old wizard. */
export const V2_LIST_STEPS = ["s1", "s2", "s3viewed", "s3picked", "s4"] as const satisfies readonly V2Step[];
/** On the shared 1..10 bar: the prizes are the old wizard's Prize (7), the payment step "Went to payment" (9). */
export const V2_STEP_STAGE: Record<V2Step, number> = { s1: 1, s2: 2, s3viewed: DRAFT_STAGE, s3picked: DRAFT_STAGE, s4: AT_PAYMENT, sent: AT_PAYMENT };

/** A new-wizard contest's own record of its steps (migration 0079). */
export type V2State = { status: string; lastStep: number | null; pricingViewedAt: string | null; packageSelectedAt: string | null; proofSent?: boolean };

/** Its step: the payment once opened (also when it waits for payment), else a picked package, else the prizes seen. */
export function v2StepOf(c: V2State): V2Step {
  if (c.proofSent) return "sent";
  const last = Number(c.lastStep) || 0;
  if (last >= 4 || c.status === "pending_payment") return "s4";
  if (c.packageSelectedAt) return "s3picked";
  if (c.pricingViewedAt || last >= 3) return "s3viewed";
  return "s2";
}

/**
 * Its total means something once the client picked a package, or went on to pay the one shown: before that it is only
 * the default package's (Growth), so the team doesn't see it as money waiting.
 */
export const v2AmountKnown = (c: V2State) => Boolean(c.packageSelectedAt) || V2_STEP_STAGE[v2StepOf(c)] >= AT_PAYMENT;

/** A new-wizard visit (its own 1–5) on the shared bar, when its contest isn't known: 1 account, 2 logo name, 3 prizes, 4–5 payment. */
export const v2VisitStage = (n: number) => V2_STEP_STAGE[n >= 4 ? "s4" : n === 3 ? "s3viewed" : n === 2 ? "s2" : "s1"];

// ---- Leads ----------------------------------------------------------------------------------------------------------

export const LEAD_STATUSES = ["new", "in_touch", "promised", "needs_help", "not_reachable", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const CLOSE_REASONS = ["not_interested", "paid_other", "fake"] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];
export const FAKE_REASONS = ["test", "fake_identity", "spam", "copy", "other"] as const;
export type FakeReason = (typeof FAKE_REASONS)[number];
/** How the team reached them. "note" is a note only. */
export const HOWS = ["call", "whatsapp", "sms", "email", "note"] as const;
export type How = (typeof HOWS)[number];
export const RESULTS = ["talked", "no_answer", "busy", "wrong_number", "will_pay", "needs_help", "not_interested", "fake"] as const;
export type Result = (typeof RESULTS)[number];
export const NEXT_PRESETS = ["2h", "tonight", "tomorrow", "3d", "week", "pick", "none", "keep"] as const;
export type NextPreset = (typeof NEXT_PRESETS)[number];

const isIn = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
export const isHow = (v: unknown): v is How => isIn(HOWS, v);
export const isResult = (v: unknown): v is Result => isIn(RESULTS, v);
export const isNextPreset = (v: unknown): v is NextPreset => isIn(NEXT_PRESETS, v);
export const isFakeReason = (v: unknown): v is FakeReason => isIn(FAKE_REASONS, v);

/**
 * What a logged result does to the lead (handoff §6): Will pay → Promised to pay; No answer twice in a row → Not
 * reachable; Wrong number → Not reachable; Needs help → Needs help; Not interested closes it. "Fake contest" never
 * comes here: it goes through Close as fake. A note only changes nothing.
 */
export function afterResult(prev: { status: LeadStatus; streak: number }, result: Exclude<Result, "fake"> | null): { status: LeadStatus; streak: number; close?: "not_interested" } {
  if (!result) return { status: prev.status, streak: prev.streak };
  const touched = prev.status === "new" || prev.status === "not_reachable" ? "in_touch" : prev.status;
  switch (result) {
    case "no_answer": {
      const streak = prev.streak + 1;
      return { status: streak >= 2 ? "not_reachable" : prev.status === "new" ? "in_touch" : prev.status, streak };
    }
    case "wrong_number":
      return { status: "not_reachable", streak: 0 };
    case "will_pay":
      return { status: "promised", streak: 0 };
    case "needs_help":
      return { status: "needs_help", streak: 0 };
    case "not_interested":
      return { status: "closed", streak: 0, close: "not_interested" };
    default:
      return { status: touched, streak: 0 };
  }
}

// ---- Time (Bangladesh) ----------------------------------------------------------------------------------------------

const DHAKA = 6 * 3_600_000;
const DAY = 86_400_000;
/** Midnight in Dhaka at the start of `now`'s day, `days` days later (negative: earlier). */
export function dhakaMidnight(now: Date, days = 0): Date {
  const local = now.getTime() + DHAKA;
  return new Date(local - (local % DAY) - DHAKA + days * DAY);
}
const at = (now: Date, days: number, hour: number) => new Date(dhakaMidnight(now, days).getTime() + hour * 3_600_000);
export const sameDhakaDay = (a: Date, b: Date) => dhakaMidnight(a).getTime() === dhakaMidnight(b).getTime();

/**
 * When the next follow-up is, from the form's choice. `picked` is a date-time field's value, read as Dhaka time.
 * "keep" leaves the planned one as it is (the caller handles it); here it means no change, so null.
 */
export function nextFollowUpAt(preset: NextPreset, now: Date, picked?: string | null): Date | null | "invalid" {
  switch (preset) {
    case "keep":
      return null;
    case "2h":
      return new Date(now.getTime() + 2 * 3_600_000);
    case "tonight": {
      const tonight = at(now, 0, 20);
      return tonight > now ? tonight : at(now, 1, 20);
    }
    case "tomorrow":
      return at(now, 1, 10);
    case "3d":
      return at(now, 3, 10);
    case "week":
      return at(now, 7, 10);
    case "none":
      return null;
    case "pick": {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(picked ?? "");
      if (!m) return "invalid";
      const when = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - DHAKA);
      return when.getTime() > now.getTime() - 60_000 && when.getTime() < now.getTime() + 180 * DAY ? when : "invalid";
    }
  }
}

// ---- Tabs, filters and sorting --------------------------------------------------------------------------------------

/** What the list needs to sort and filter a lead (the page's Lead has these and more). */
export type LeadState = {
  status: LeadStatus;
  closedReason: CloseReason | null;
  hidden: boolean;
  contacts: number;
  nextAt: Date | null;
  wonBackAt: Date | null;
  amount: number | null;
  stage: number;
  ownerId: string | null;
  createdAt: Date;
  /** The latest of what the client did and what the team logged: the "activity" sort. */
  lastActivityAt: Date;
  /**
   * When the client last did something themselves (saves, visits, being seen), never the team's contacts: "Last active"
   * and its filter. Null when nothing of theirs is left (a lead kept from its own copy); left out, the activity above.
   */
  clientActivityAt?: Date | null;
  /** The new wizard's step (onboarding v2); none for the old wizard. */
  v2Step?: V2Step | null;
};

export const TABS = ["all", "new", "today", "overdue", "promised", "unreachable", "won", "closed"] as const;
export type Tab = (typeof TABS)[number];
export const SORTS = ["money", "newest", "activity", "next"] as const;
export type Sort = (typeof SORTS)[number];
export const AMOUNTS = ["lt5k", "5to10k", "gt10k"] as const;
export type Amount = (typeof AMOUNTS)[number];
export const STARTED = ["today", "7", "30", "older"] as const;
export type Started = (typeof STARTED)[number];
/** "Last active" (owner, 2026-10-29; spec §4): did something in the last 24 hours, 3 days or 7 days. */
export const ACTIVE = ["24h", "3d", "7d"] as const;
export type Active = (typeof ACTIVE)[number];
const ACTIVE_HOURS: Record<Active, number> = { "24h": 24, "3d": 72, "7d": 168 };
export const RANGES = ["today", "7", "30", "90"] as const;
export type Range = (typeof RANGES)[number];
/** Days back for each range (0 = today). */
export const RANGE_DAYS: Record<Range, number> = { today: 0, "7": 6, "30": 29, "90": 89 };

/** Still to follow up: not closed and not paid. */
export const isOpen = (l: LeadState) => l.status !== "closed" && !l.wonBackAt;
export const isOverdue = (l: LeadState, now: Date) => isOpen(l) && Boolean(l.nextAt && l.nextAt.getTime() < now.getTime());

export function inTab(l: LeadState, tab: Tab, now: Date): boolean {
  switch (tab) {
    case "all":
      return isOpen(l);
    case "new":
      return isOpen(l) && l.status === "new" && l.contacts === 0;
    case "today":
      return isOpen(l) && Boolean(l.nextAt && sameDhakaDay(l.nextAt, now));
    case "overdue":
      return isOverdue(l, now);
    case "promised":
      return isOpen(l) && l.status === "promised";
    case "unreachable":
      return isOpen(l) && l.status === "not_reachable";
    case "won":
      return Boolean(l.wonBackAt);
    case "closed":
      return l.status === "closed";
  }
}

/** The pill on a lead: closed and paid first, then overdue, then what was logged. */
export type ShownStatus = LeadStatus | "overdue" | "won" | `closed_${CloseReason}`;
export function shownStatus(l: LeadState, now: Date): ShownStatus {
  if (l.wonBackAt) return "won";
  if (l.status === "closed") return `closed_${l.closedReason ?? "not_interested"}`;
  if (isOverdue(l, now)) return "overdue";
  return l.status;
}

/** `only`: the leads a phone or email search found (their keys, never the number itself). */
export type UnpaidQuery = { tab: Tab; q: string; sort: Sort; step: number | null; owner: string | null; amount: Amount | null; started: Started | null; active: Active | null; v2step: V2Step | null; range: Range; sel: string | null; only: string[] | null };
export const DEFAULT_QUERY: UnpaidQuery = { tab: "all", q: "", sort: "money", step: null, owner: null, amount: null, started: null, active: null, v2step: null, range: "30", sel: null, only: null };

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T) => (isIn(list, one(v)) ? (one(v) as T) : fallback);
const pickOrNull = <T extends string>(list: readonly T[], v: unknown) => (isIn(list, one(v)) ? (one(v) as T) : null);
const UUID = /^[0-9a-f-]{36}$/i;
/**
 * A lead's key in the address: c:<contest id> for a draft, g:<visit id> for a guest, l:<lead id> for a lead whose
 * draft or visits are gone. Never a phone number.
 */
export const LEAD_KEY = /^[cgl]:[0-9a-f-]{36}$/i;

export function parseUnpaidQuery(sp: Record<string, string | string[] | undefined>): UnpaidQuery {
  const step = Number(one(sp.step));
  const owner = String(one(sp.owner) ?? "");
  const sel = String(one(sp.sel) ?? "");
  const only = String(one(sp.only) ?? "")
    .split(",")
    .filter((k) => LEAD_KEY.test(k))
    .slice(0, 20);
  return {
    tab: pick(TABS, sp.tab, "all"),
    // A phone number or email never stays in the address (they are searched through the server instead).
    q: ((s) => (isContactSearch(s) ? "" : s))(String(one(sp.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 80)),
    sort: pick(SORTS, sp.sort, "money"),
    step: Number.isInteger(step) && step >= 1 && step <= STAGES ? step : null,
    owner: owner === "me" || owner === "none" || UUID.test(owner) ? owner : null,
    amount: pickOrNull(AMOUNTS, sp.amount),
    started: pickOrNull(STARTED, sp.started),
    active: pickOrNull(ACTIVE, sp.active),
    v2step: pickOrNull(V2_LIST_STEPS, sp.v2step),
    range: pick(RANGES, sp.range, "30"),
    sel: LEAD_KEY.test(sel) ? sel : null,
    only: only.length ? only : null,
  };
}

/** The page's address with some of the view changed (defaults are left out). */
export function unpaidHref(q: UnpaidQuery, change: Partial<UnpaidQuery> = {}, hash = ""): string {
  const next = { ...q, ...change };
  const params = new URLSearchParams();
  for (const k of Object.keys(DEFAULT_QUERY) as (keyof UnpaidQuery)[]) {
    const v = next[k];
    if (v === null || v === "" || v === DEFAULT_QUERY[k] || (Array.isArray(v) && !v.length)) continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return `/admin/unpaid${s ? `?${s}` : ""}${hash}`;
}

/** A search that is a phone number or an email: looked up on the server, never put in the address. */
export const isContactSearch = (text: string) => text.includes("@") || text.replace(/\D/g, "").length >= 6;

/** The filters (not the tab): an admin's own view of who to call. */
export function matchesFilters(l: LeadState, q: UnpaidQuery, now: Date, me: string): boolean {
  if (q.step !== null && l.stage !== q.step) return false;
  if (q.owner === "me" && l.ownerId !== me) return false;
  if (q.owner === "none" && l.ownerId) return false;
  if (q.owner && q.owner !== "me" && q.owner !== "none" && l.ownerId !== q.owner) return false;
  if (q.amount) {
    if (l.amount === null) return false;
    if (q.amount === "lt5k" && !(l.amount < 5000)) return false;
    if (q.amount === "5to10k" && !(l.amount >= 5000 && l.amount <= 10000)) return false;
    if (q.amount === "gt10k" && !(l.amount > 10000)) return false;
  }
  if (q.started) {
    const t = l.createdAt.getTime();
    if (q.started === "today" && t < dhakaMidnight(now).getTime()) return false;
    if (q.started === "7" && t < dhakaMidnight(now, -6).getTime()) return false;
    if (q.started === "30" && t < dhakaMidnight(now, -29).getTime()) return false;
    if (q.started === "older" && t >= dhakaMidnight(now, -29).getTime()) return false;
  }
  if (q.active) {
    // The client's own activity: a call the team logged doesn't make them "active" (not known: not active).
    const at = l.clientActivityAt === undefined ? l.lastActivityAt : l.clientActivityAt;
    if (!at || now.getTime() - at.getTime() > ACTIVE_HOURS[q.active] * 3_600_000) return false;
  }
  // Only the new wizard's leads have its steps.
  if (q.v2step && l.v2Step !== q.v2step) return false;
  return true;
}

export function sortLeads<T extends LeadState>(list: T[], sort: Sort): T[] {
  const time = (d: Date | null) => (d ? d.getTime() : Infinity);
  const by: Record<Sort, (a: T, b: T) => number> = {
    money: (a, b) => (b.amount ?? -1) - (a.amount ?? -1) || b.createdAt.getTime() - a.createdAt.getTime(),
    newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    activity: (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
    next: (a, b) => time(a.nextAt) - time(b.nextAt) || b.createdAt.getTime() - a.createdAt.getTime(),
  };
  return [...list].sort(by[sort]);
}

// ---- Close as fake --------------------------------------------------------------------------------------------------

export type FakeClose = { confirmed: boolean; reason: string; note: string; hide: boolean; block: boolean; stopReminders: boolean };
/** Close as fake needs the tick, a reason and a note (handoff §7); the keys of what is missing. */
export function fakeCloseErrors(f: Pick<FakeClose, "confirmed" | "reason" | "note">): ("confirm" | "reason" | "note")[] {
  return [...(f.confirmed ? [] : ["confirm" as const]), ...(isFakeReason(f.reason) ? [] : ["reason" as const]), ...(f.note.trim().length >= 3 ? [] : ["note" as const])];
}
