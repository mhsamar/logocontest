import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** A-06 Payments page (design/admin/payments.html, owner 2026-10-10): every payment with what it paid for. */
export type PaymentRow = {
  id: string;
  purpose: "contest" | "extension" | "addon";
  method: string;
  gateway: string;
  txnId: string | null;
  amount: number;
  status: "initiated" | "paid" | "failed";
  createdAt: Date;
  paidAt: Date | null;
  contest: { id: string; slug: string; brand: string; number: number | null; prize: number; fee: number; addons: number; createdAt: Date } | null;
  client: { id: string; name: string; createdAt: Date | null } | null;
};

type C = { id: string; slug: string; brand_name: string; contest_number: number | null; prize_amount: number; service_fee_amount: number; upgrades_amount: number; created_at: string };
type P = { id: string; name: string; created_at: string | null };

/** Newest first, up to 2,000 (paged in 1,000s: the API's page size). */
export async function paymentsOverview(): Promise<PaymentRow[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const cols =
    "id, purpose, method, gateway, gateway_txn_id, amount, status, created_at, paid_at, contest:contests!contest_id(id, slug, brand_name, contest_number, prize_amount, service_fee_amount, upgrades_amount, created_at), client:profiles!client_id(id, name, created_at)";
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 2000; from += 1000) {
    const { data } = await db.from("payments").select(cols).order("created_at", { ascending: false }).range(from, from + 999);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return rows.map((p) => {
    const c = one(p.contest as C | C[] | null);
    const u = one(p.client as P | P[] | null);
    return {
      id: p.id as string,
      purpose: p.purpose as PaymentRow["purpose"],
      method: p.method as string,
      gateway: p.gateway as string,
      txnId: (p.gateway_txn_id as string | null) ?? null,
      amount: p.amount as number,
      status: p.status as PaymentRow["status"],
      createdAt: new Date(p.created_at as string),
      paidAt: p.paid_at ? new Date(p.paid_at as string) : null,
      contest: c ? { id: c.id, slug: c.slug, brand: c.brand_name, number: c.contest_number ?? null, prize: c.prize_amount, fee: c.service_fee_amount, addons: c.upgrades_amount, createdAt: new Date(c.created_at) } : null,
      client: u ? { id: u.id, name: u.name, createdAt: u.created_at ? new Date(u.created_at) : null } : null,
    };
  });
}

/** What a payment pays for: the prize (held for designers) and the platform's part. Add-ons bought later and
 * extensions go to the platform in full (as on the Dashboard). */
export function splitOf(p: PaymentRow): { prize: number; platform: number; fees: number; addons: number } {
  if (p.purpose === "contest" && p.contest) return { prize: p.contest.prize, platform: p.amount - p.contest.prize, fees: p.contest.fee, addons: p.contest.addons };
  return { prize: 0, platform: p.amount, fees: 0, addons: p.amount };
}
