import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutFor } from "@/lib/wallet/fees";
import { maskDestination } from "@/lib/wallet/queries";
import { one } from "./core";

/**
 * Designer payouts (owner, 2026-10-16): every withdrawal, who was paid, how much, when, by whom and with which
 * transaction ID, and where the designers' money stands right now. Small volumes, so it is summed here.
 */

export type PayoutStatus = "requested" | "paid" | "rejected";

export type PayoutRow = {
  id: string;
  amount: number;
  status: PayoutStatus;
  methodType: "bkash" | "bank";
  /** The details the designer gave at request time (full number, for paying). */
  full: Record<string, string>;
  masked: string;
  txnId: string | null;
  gateway: string | null;
  rejectReason: string | null;
  createdAt: Date;
  processedAt: Date | null;
  processedBy: string | null;
  designer: { id: string; name: string; username: string | null; avatarUrl: string | null; wins: number };
};

/** Every withdrawal, newest first. */
export async function payoutRows(limit = 1000): Promise<PayoutRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("withdrawals")
    .select(
      "id, amount, status, method_type, destination, paid_txn_id, gateway, reject_reason, created_at, processed_at, designer:profiles!designer_id(id, name, username, avatar_path, wins_count), admin:profiles!processed_by(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((w) => {
    const d = one(w.designer as Record<string, unknown> | Record<string, unknown>[] | null);
    const full = (w.destination ?? {}) as Record<string, string>;
    return {
      id: w.id as string,
      amount: w.amount as number,
      status: w.status as PayoutStatus,
      methodType: w.method_type as "bkash" | "bank",
      full,
      masked: maskDestination(w.method_type as string, full),
      txnId: (w.paid_txn_id as string | null) ?? null,
      gateway: (w.gateway as string | null) ?? null,
      rejectReason: (w.reject_reason as string | null) ?? null,
      createdAt: new Date(w.created_at as string),
      processedAt: w.processed_at ? new Date(w.processed_at as string) : null,
      processedBy: one(w.admin as { name: string } | { name: string }[] | null)?.name ?? null,
      designer: {
        id: (d?.id as string) ?? "",
        name: (d?.name as string) ?? "—",
        username: (d?.username as string | null) ?? null,
        avatarUrl: avatarUrl((d?.avatar_path as string | null) ?? null),
        wins: (d?.wins_count as number | null) ?? 0,
      },
    };
  });
}

export type DesignerMoney = {
  /** In the wallet now, not yet asked for. */
  balance: number;
  /** Earned on the site so far: prizes, shares and bonuses after fees. */
  earned: number;
  /** Sent to them before. */
  paid: { total: number; count: number };
  /** Their latest earnings: where the money came from. */
  recent: { brand: string | null; amount: number; at: Date; type: string }[];
};

/** For the "To pay" cards: each designer's wallet, what was paid before and where the money came from. */
export async function designerMoney(designerIds: string[]): Promise<Map<string, DesignerMoney>> {
  const out = new Map<string, DesignerMoney>();
  const ids = [...new Set(designerIds.filter(Boolean))];
  if (ids.length === 0 || !isSupabaseConfigured()) return out;
  const db = createAdminClient();
  const [txs, paid] = await Promise.all([
    db.from("wallet_transactions").select("designer_id, type, amount, created_at, contest:contests!contest_id(brand_name)").in("designer_id", ids).order("seq", { ascending: false }).limit(5000),
    db.from("withdrawals").select("designer_id, amount").in("designer_id", ids).eq("status", "paid").limit(5000),
  ]);
  for (const id of ids) out.set(id, { balance: 0, earned: 0, paid: { total: 0, count: 0 }, recent: [] });
  for (const r of txs.data ?? []) {
    const m = out.get(r.designer_id as string)!;
    m.balance += r.amount as number;
    if (["prize_credit", "split_share", "bonus"].includes(r.type as string)) {
      m.earned += r.amount as number;
      if (m.recent.length < 3) m.recent.push({ brand: one(r.contest as { brand_name: string } | { brand_name: string }[] | null)?.brand_name ?? null, amount: r.amount as number, at: new Date(r.created_at as string), type: r.type as string });
    }
  }
  for (const r of paid.data ?? []) {
    const m = out.get(r.designer_id as string)!;
    m.paid.total += r.amount as number;
    m.paid.count += 1;
  }
  return out;
}

export type MoneyNow = {
  /** Sitting in designers' wallets, not yet asked for. */
  inWallets: number;
  /** Asked for, waiting for someone to send it. */
  waiting: { total: number; count: number };
  /** Won prizes not in a wallet yet: files still to come, or the hold after approval. */
  notReleased: { total: number; count: number };
};

/** Where the designers' money stands right now (not tied to a period). */
export async function moneyNow(): Promise<MoneyNow> {
  const empty: MoneyNow = { inWallets: 0, waiting: { total: 0, count: 0 }, notReleased: { total: 0, count: 0 } };
  if (!isSupabaseConfigured()) return empty;
  const db = createAdminClient();
  const [txs, waiting, handovers] = await Promise.all([
    db.from("wallet_transactions").select("amount").limit(50000),
    db.from("withdrawals").select("amount").eq("status", "requested").limit(5000),
    db.from("handovers").select("prize, fee_rate").in("status", ["awaiting_files", "submitted", "revision_requested", "approved"]).is("credited_at", null).limit(5000),
  ]);
  const held = (handovers.data ?? []).map((h) => payoutFor(h.prize as number, h.fee_rate as number).credit);
  return {
    inWallets: (txs.data ?? []).reduce((a, r) => a + (r.amount as number), 0),
    waiting: { total: (waiting.data ?? []).reduce((a, r) => a + (r.amount as number), 0), count: waiting.data?.length ?? 0 },
    notReleased: { total: held.reduce((a, n) => a + n, 0), count: held.length },
  };
}

export type PaidOut = { total: number; count: number; designers: number; earned: number };

/** Sent to designers in a period (by the day it was paid), and what designers earned in it. */
export async function paidOutIn(period: { since: Date | null; until: Date | null }): Promise<PaidOut> {
  if (!isSupabaseConfigured()) return { total: 0, count: 0, designers: 0, earned: 0 };
  const db = createAdminClient();
  const since = (period.since ?? new Date(0)).toISOString();
  const until = (period.until ?? new Date(Date.now() + 86_400_000)).toISOString();
  const [paid, earned] = await Promise.all([
    db.from("withdrawals").select("designer_id, amount").eq("status", "paid").gte("processed_at", since).lt("processed_at", until).limit(5000),
    db.from("wallet_transactions").select("amount").in("type", ["prize_credit", "split_share", "bonus"]).gte("created_at", since).lt("created_at", until).limit(10000),
  ]);
  const rows = paid.data ?? [];
  return {
    total: rows.reduce((a, r) => a + (r.amount as number), 0),
    count: rows.length,
    designers: new Set(rows.map((r) => r.designer_id as string)).size,
    earned: (earned.data ?? []).reduce((a, r) => a + (r.amount as number), 0),
  };
}
