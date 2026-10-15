import "server-only";
import { openClaimHandoverIds } from "@/lib/claims/queries";
import { heldPrizeAvailableAt } from "@/lib/claims/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { feeRateFor, nextTier, payoutFor, type FeeTier } from "./fees";

/** D-10 Wallet: balance, pending, fee tier, history and payout methods (BLUEPRINT §7.3, §9.5). */
export type WalletTx = {
  id: string;
  type: "prize_credit" | "split_share" | "withdrawal" | "adjustment" | "bonus";
  amount: number;
  balanceAfter: number;
  feeRate: number | null;
  feeAmount: number | null;
  brand: string | null;
  note: string | null;
  createdAt: Date;
};

export type WalletWithdrawal = {
  id: string;
  amount: number;
  methodType: "bkash" | "bank";
  destination: string;
  status: "requested" | "paid" | "rejected";
  txnId: string | null;
  rejectReason: string | null;
  createdAt: Date;
  /** When it was sent (or turned down). */
  processedAt: Date | null;
};

export type PayoutMethod = { id: string; type: "bkash" | "bank"; label: string; isDefault: boolean; bkashNumber: string | null; bkashKind: "personal" | "agent" | null };

export type Wallet = {
  balance: number;
  pending: number;
  /** Approved prizes still in the copy-claim hold (§7.3): available from the date, or frozen (null) while a claim is open. */
  held: { brand: string; credit: number; availableAt: Date | null }[];
  countedWins: number;
  rate: number;
  next: { tier: FeeTier; winsToGo: number } | null;
  tiers: FeeTier[];
  minWithdrawal: number;
  transactions: WalletTx[];
  withdrawals: WalletWithdrawal[];
  methods: PayoutMethod[];
  /** Owner, 2026-10-16: every taka sent so far, what is on its way, and all they earned here (after fees). */
  paidOut: { total: number; count: number };
  requested: { total: number; count: number };
  earned: number;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** "bKash 01712…511" / "City Bank •••• 4321": enough to recognise, never the full number. */
export function maskDestination(type: string, d: Record<string, string | undefined>): string {
  if (type === "bkash") {
    const n = (d.bkash_number ?? "").replace(/^\+?880/, "0");
    return `bKash ${n.slice(0, 5)}…${n.slice(-3)}`;
  }
  const acct = d.account_number ?? "";
  return `${d.bank_name ?? "Bank"} •••• ${acct.slice(-4)}`;
}

export async function getWallet(designerId: string): Promise<Wallet> {
  const s = await getSettings(["fees.designer_tiers", "limits.withdrawal_min", "timers.payout_hold_days"]);
  const tiers = [...s["fees.designer_tiers"]].sort((a, b) => a.min_wins - b.min_wins);
  const empty: Wallet = {
    balance: 0,
    pending: 0,
    held: [],
    countedWins: 0,
    rate: feeRateFor(0, tiers),
    next: nextTier(0, tiers),
    tiers,
    minWithdrawal: s["limits.withdrawal_min"],
    transactions: [],
    withdrawals: [],
    methods: [],
    paidOut: { total: 0, count: 0 },
    requested: { total: 0, count: 0 },
    earned: 0,
  };
  if (!isSupabaseConfigured()) return empty;

  const db = createAdminClient();
  const [profile, txs, withdrawals, open, methods, approved, claimed, allOut, earnedRows] = await Promise.all([
    db.from("profiles").select("counted_wins_count").eq("id", designerId).single(),
    db
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, fee_rate, fee_amount, note, created_at, contest:contests!contest_id(brand_name)")
      .eq("designer_id", designerId)
      .order("seq", { ascending: false })
      .limit(50),
    db.from("withdrawals").select("id, amount, method_type, destination, status, paid_txn_id, reject_reason, created_at, processed_at").eq("designer_id", designerId).order("created_at", { ascending: false }).limit(20),
    db.from("handovers").select("prize, fee_rate").eq("designer_id", designerId).in("status", ["awaiting_files", "submitted", "revision_requested"]),
    db.from("designer_payout_methods").select("id, type, bkash_number, bkash_kind, bank_name, account_number, is_default").eq("user_id", designerId).order("is_default", { ascending: false }),
    db.from("handovers").select("id, prize, fee_rate, approved_at, created_at, contest:contests!contest_id(brand_name)").eq("designer_id", designerId).eq("status", "approved").is("credited_at", null),
    openClaimHandoverIds(designerId),
    db.from("withdrawals").select("amount, status").eq("designer_id", designerId).in("status", ["paid", "requested"]).limit(5000),
    db.from("wallet_transactions").select("amount").eq("designer_id", designerId).in("type", ["prize_credit", "split_share", "bonus"]).limit(5000),
  ]);
  const sumOf = (status: string) => {
    const rows = (allOut.data ?? []).filter((r) => r.status === status);
    return { total: rows.reduce((a, r) => a + (r.amount as number), 0), count: rows.length };
  };

  const held = (approved.data ?? []).map((h) => ({
    brand: one(h.contest as { brand_name: string } | { brand_name: string }[] | null)?.brand_name ?? "",
    credit: payoutFor(h.prize as number, h.fee_rate as number).credit,
    // Owner, 2026-10-12: the hold counts from the client's approval (migration 0039).
    availableAt: heldPrizeAvailableAt(new Date((h.approved_at ?? h.created_at) as string), s["timers.payout_hold_days"], claimed.has(h.id as string)),
  }));

  const countedWins = (profile.data?.counted_wins_count as number) ?? 0;
  const transactions: WalletTx[] = (txs.data ?? []).map((r) => ({
    id: r.id as string,
    type: r.type as WalletTx["type"],
    amount: r.amount as number,
    balanceAfter: r.balance_after as number,
    feeRate: (r.fee_rate as number | null) ?? null,
    feeAmount: (r.fee_amount as number | null) ?? null,
    brand: one(r.contest as { brand_name: string } | { brand_name: string }[] | null)?.brand_name ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
  }));

  return {
    balance: transactions[0]?.balanceAfter ?? 0,
    pending: (open.data ?? []).reduce((sum, h) => sum + payoutFor(h.prize as number, h.fee_rate as number).credit, 0) + held.reduce((sum, h) => sum + h.credit, 0),
    held,
    countedWins,
    rate: feeRateFor(countedWins, tiers),
    next: nextTier(countedWins, tiers),
    tiers,
    minWithdrawal: s["limits.withdrawal_min"],
    transactions,
    withdrawals: (withdrawals.data ?? []).map((w) => ({
      id: w.id as string,
      amount: w.amount as number,
      methodType: w.method_type as "bkash" | "bank",
      destination: maskDestination(w.method_type as string, (w.destination ?? {}) as Record<string, string>),
      status: w.status as WalletWithdrawal["status"],
      txnId: (w.paid_txn_id as string | null) ?? null,
      rejectReason: (w.reject_reason as string | null) ?? null,
      createdAt: new Date(w.created_at as string),
      processedAt: w.processed_at ? new Date(w.processed_at as string) : null,
    })),
    paidOut: sumOf("paid"),
    requested: sumOf("requested"),
    earned: (earnedRows.data ?? []).reduce((a, r) => a + (r.amount as number), 0),
    methods: (methods.data ?? []).map((m) => ({
      id: m.id as string,
      type: m.type as "bkash" | "bank",
      label: maskDestination(m.type as string, m as unknown as Record<string, string>),
      isDefault: Boolean(m.is_default),
      // For filling in the withdraw form (owner, 2026-10-12): the number as 01XXXXXXXXX and Personal / Agent.
      bkashNumber: m.type === "bkash" && m.bkash_number ? (m.bkash_number as string).replace(/^\+?880/, "0") : null,
      bkashKind: ((m as { bkash_kind?: string | null }).bkash_kind as "personal" | "agent" | null) ?? null,
    })),
  };
}
