import { formatUsdCents } from "@/lib/currency/rules";
import type { Locale } from "@/lib/i18n/config";
import { formatTaka } from "@/lib/money";
import { isManual, isTxnId, normalizeTxn } from "@/lib/payments/manual-rules";

/**
 * Money-back guarantee (owner, 2026-10-21; BLUEPRINT §7.10; migration 0069). If a contest ends with designs from fewer
 * than {min} different designers, its client can claim back everything they paid for it, until the pick-a-winner
 * deadline and before any winner is picked. Pure: shared by the server, the pages and the tests. The database
 * counts and checks the same things again when the client claims and when the team approves.
 */

/**
 * Designs that make their designer count. Also counted: a design the client rejected and its designer then took
 * back, and, when the team decides, designs still held for checking. Keep in step with guarantee_designer_ids (0069).
 */
export const COUNTED_STATUSES = ["active", "rejected", "winner", "forfeited"] as const;

export const CLAIM_STATUSES = ["pending", "approved", "refunded", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];
export const isClaimStatus = (v: unknown): v is ClaimStatus => (CLAIM_STATUSES as readonly unknown[]).includes(v);

export const CLAIM_NOTE_MAX = 500;
/** "Please check the count" needs a reason this long (enough designers were counted). */
export const CHECK_NOTE_MIN = 20;
/** What the client is told when the team says no. */
export const REPLY_MIN = 5;
export const REPLY_MAX = 500;
export const INTERNAL_MAX = 1000;

export type CountEntry = { designerId: string; status: string; rejected: boolean; designerIsTest: boolean };

/** The different designers who count. Test designers are left out only in a test client's contest (QA). */
export function countedDesigners(entries: CountEntry[], opts: { withHeld: boolean; testContest: boolean }): string[] {
  const ids = new Set<string>();
  for (const e of entries) {
    if (opts.testContest && e.designerIsTest) continue;
    const counted = (COUNTED_STATUSES as readonly string[]).includes(e.status) || (opts.withHeld && e.status === "held") || (e.status === "withdrawn" && e.rejected);
    if (counted) ids.add(e.designerId);
  }
  return [...ids];
}

export type GuaranteeContest = {
  status: string;
  /** The promise stamped when the client paid (null: this contest has no guarantee). */
  guaranteeDesigners: number | null;
  judgingEndsAt: Date | null;
  completedAt: Date | null;
  adminReview: boolean;
  hadHandover: boolean;
  contestPaid: boolean;
  /** Any wallet line for the contest (a no-result share, an adjustment…). */
  hadPayout: boolean;
};

export type GuaranteeState =
  /** No guarantee, or its time is over. */
  | { kind: "none" }
  /** Covered, still running: the promise is shown. */
  | { kind: "covered"; min: number }
  /** Fewer designers than promised: the client can claim. */
  | { kind: "available"; late: boolean; until: Date | null; designers: number; min: number }
  /** Enough designers were counted, but the client can ask the team to check the count. */
  | { kind: "check"; late: boolean; until: Date | null; designers: number; min: number }
  | { kind: "claimed"; status: ClaimStatus };

/** Where a contest stands with the guarantee. `designers` = counted without held designs. */
export function guaranteeState(c: GuaranteeContest, designers: number, claim: ClaimStatus | null, now: Date, lateDays: number): GuaranteeState {
  if (claim) return { kind: "claimed", status: claim };
  const min = c.guaranteeDesigners;
  if (!min || !c.contestPaid || c.hadHandover) return { kind: "none" };
  if (c.status === "open") return { kind: "covered", min };
  let window: { late: boolean; until: Date | null } | null = null;
  if (c.status === "judging" && c.judgingEndsAt && c.judgingEndsAt > now) window = { late: false, until: c.judgingEndsAt };
  else if (c.status === "no_result" && c.adminReview && !c.hadPayout && c.completedAt) {
    const until = new Date(c.completedAt.getTime() + lateDays * 86_400_000);
    if (until > now) window = { late: true, until };
  }
  if (!window) return { kind: "none" };
  return { kind: designers < min ? "available" : "check", ...window, designers, min };
}

// ---- Paying the money back ------------------------------------------------------------------------------------------

/** One paid payment of the contest, as guarantee_paid (0069) lists it. */
export type PaidLine = {
  id: string;
  purpose: string;
  gateway: string;
  method: string;
  currency: string;
  amount: number;
  cents: number | null;
  txn: string | null;
  intent: string | null;
  sender: string | null;
  qa: boolean;
};

/** How part of the money goes back: one bKash transfer for every manual bKash line, one Stripe refund per card line. */
export type RefundRoute = { key: string; kind: "bkash" | "stripe" | "other" | "none"; taka: number; usdCents: number; lineIds: string[]; gateway: string; intent: string | null; txns: string[] };

export function refundRoutes(lines: PaidLine[]): RefundRoute[] {
  const routes = new Map<string, RefundRoute>();
  for (const l of lines) {
    // QA and local test payments: no money moved, so none goes back.
    const kind: RefundRoute["kind"] = l.qa ? "none" : isManual(l.gateway) ? "bkash" : l.gateway === "stripe" ? "stripe" : "other";
    const key = kind === "none" || kind === "bkash" ? kind : l.id;
    const r = routes.get(key) ?? { key, kind, taka: 0, usdCents: 0, lineIds: [], gateway: l.gateway, intent: null, txns: [] };
    r.taka += l.amount;
    if (l.currency === "USD") r.usdCents += l.cents ?? 0;
    r.lineIds.push(l.id);
    if (l.intent && !r.intent) r.intent = l.intent;
    if (l.txn) r.txns.push(l.txn);
    routes.set(key, r);
  }
  const order = { bkash: 0, stripe: 1, other: 2, none: 3 };
  return [...routes.values()].sort((a, b) => order[a.kind] - order[b.kind]);
}

/** Taka and dollars to send back. Dollars only ever come from what Stripe charged (never converted again). */
export function refundTotals(lines: PaidLine[]): { taka: number; usdCents: number; bkashTaka: number } {
  const routes = refundRoutes(lines);
  return {
    taka: lines.reduce((s, l) => s + l.amount, 0),
    usdCents: lines.reduce((s, l) => s + (l.currency === "USD" ? (l.cents ?? 0) : 0), 0),
    bkashTaka: routes.find((r) => r.kind === "bkash")?.taka ?? 0,
  };
}

/** The amount part of a route, for texts (what the client and the team read). */
export type RouteAmount = Pick<RefundRoute, "kind" | "taka" | "usdCents">;
export const routeAmounts = (lines: PaidLine[]): RouteAmount[] => refundRoutes(lines).map(({ kind, taka, usdCents }) => ({ kind, taka, usdCents }));

/**
 * What goes back, written out: card refunds in the dollars Stripe charged, the rest in taka, e.g. "৳6,250 + $8.20".
 * With no route given (only a total), the total in taka.
 */
export function refundAmountText(routes: RouteAmount[], locale: Locale, fallbackTaka = 0): string {
  const usd = routes.filter((r) => r.kind === "stripe").reduce((s, r) => s + r.usdCents, 0);
  const taka = routes.filter((r) => r.kind !== "stripe").reduce((s, r) => s + r.taka, 0);
  if (!routes.length) return formatTaka(fallbackTaka, locale);
  return [taka > 0 || usd === 0 ? formatTaka(taka, locale) : null, usd > 0 ? formatUsdCents(usd, locale) : null].filter(Boolean).join(" + ");
}

/** A bKash number is needed only when real money came by manual bKash. */
export const needsBkashNumber = (lines: PaidLine[]) => refundRoutes(lines).some((r) => r.kind === "bkash");

/** The bKash number the money came from (the first one the payer gave), as a suggestion. */
export const suggestedRefundNumber = (lines: PaidLine[]): string | null => lines.find((l) => !l.qa && isManual(l.gateway) && l.sender)?.sender ?? null;

/** A refund reference: a bKash TrxID, a Stripe refund id (re_…), or the other gateway's reference. */
export function cleanRefundRef(kind: RefundRoute["kind"], v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (kind === "bkash") {
    const txn = normalizeTxn(s);
    return isTxnId(txn) ? txn : null;
  }
  if (kind === "stripe") return /^re_[A-Za-z0-9]{6,}$/.test(s) ? s : null;
  if (kind === "other") return s.length >= 3 && s.length <= 100 && !/\s/.test(s) ? s : null;
  return null;
}

/** Every route that moves money has its reference. */
export const refundsComplete = (routes: RefundRoute[], refs: Record<string, string>) => routes.every((r) => r.kind === "none" || Boolean(refs[r.key]));

// ---- The team's decision -------------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Designers the team leaves out of the count, each with a reason; only designers who were counted. Null when invalid. */
export function cleanExclusions(input: unknown, counted: string[]): { designer_id: string; reason: string }[] | null {
  if (input === undefined || input === null || input === "") return [];
  if (!Array.isArray(input)) return null;
  const out: { designer_id: string; reason: string }[] = [];
  for (const x of input) {
    const id = typeof x?.designer_id === "string" ? x.designer_id : "";
    const reason = typeof x?.reason === "string" ? x.reason.replace(/\s+/g, " ").trim() : "";
    if (!UUID.test(id) || !counted.includes(id) || reason.length < REPLY_MIN || reason.length > 200 || out.some((o) => o.designer_id === id)) return null;
    out.push({ designer_id: id, reason });
  }
  return out;
}

/** The guarantee:<code> errors the database raises. */
export const CLAIM_ERRORS = ["not_found", "none", "already", "winner", "not_paid", "closed", "enough", "note", "not_pending", "status", "held", "reports", "waiting_payment", "paid_out", "frozen"] as const;
export type ClaimError = (typeof CLAIM_ERRORS)[number];

export function claimErrorOf(message: string | null | undefined, code?: string | null): ClaimError | null {
  if (code === "23505") return "already";
  const m = /guarantee:([a-z_]+)/.exec(message ?? "");
  return m && (CLAIM_ERRORS as readonly string[]).includes(m[1]) ? (m[1] as ClaimError) : null;
}
