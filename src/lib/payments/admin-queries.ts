import "server-only";
import { one } from "@/lib/admin/core";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROOF_BUCKET, type ManualKind } from "./manual";
import type { PromoKind } from "./manual-rules";

/** Admin › Payments › Approvals and Promo codes (owner, 2026-10-14). */

const db = () => createAdminClient();

export type ProofStatus = "pending" | "approved" | "rejected";

export type ProofRow = {
  id: string;
  kind: ManualKind;
  paymentId: string;
  method: string;
  toNumber: string;
  amount: number;
  txnId: string;
  sender: string | null;
  shotUrl: string | null;
  qa: boolean;
  status: ProofStatus;
  note: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewer: string | null;
  payer: { id: string; name: string; email: string | null; mobile: string | null; role: string } | null;
  contest: { slug: string; brand: string; number: number | null; status: string } | null;
  /** What the payment buys: an add-on key, "+N days", or null (contest / Pro). */
  item: { addon: string | null; days: number | null };
};

type Person = { id: string; name: string; email: string | null; mobile: string | null; role: string };
type Contest = { slug: string; brand_name: string; contest_number: number | null; status: string };

/** Proofs with this status, newest first (waiting ones oldest first, so the first sent is checked first). */
export async function proofList(status: ProofStatus, limit = 100): Promise<ProofRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await db()
    .from("manual_payments")
    .select(
      "id, kind, payment_id, method, to_number, amount, txn_id, sender_number, screenshot_path, qa_code, status, note, created_at, reviewed_at, payer:profiles!user_id(id, name, email, mobile, role), reviewer:profiles!reviewed_by(name), contest:contests!contest_id(slug, brand_name, contest_number, status)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(limit);
  if (error || !data) return [];
  const paymentIds = data.filter((r) => r.kind === "addon").map((r) => r.payment_id as string);
  const items = new Map<string, { addon: string | null; days: number | null }>();
  if (paymentIds.length) {
    const { data: pays } = await db().from("payments").select("id, addon, extension_days").in("id", paymentIds);
    for (const p of pays ?? []) items.set(p.id as string, { addon: (p.addon as string | null) ?? null, days: (p.extension_days as number | null) ?? null });
  }
  const shots = data.map((r) => r.screenshot_path as string | null).filter((p): p is string => Boolean(p));
  const urls = shots.length ? await getFileStorage().createReadUrls(PROOF_BUCKET, shots, 600).catch(() => new Map<string, string>()) : new Map<string, string>();
  return data.map((r) => {
    const payer = one(r.payer as Person | Person[] | null);
    const c = one(r.contest as Contest | Contest[] | null);
    const reviewer = one(r.reviewer as { name: string } | { name: string }[] | null);
    return {
      id: r.id as string,
      kind: r.kind as ManualKind,
      paymentId: r.payment_id as string,
      method: r.method as string,
      toNumber: r.to_number as string,
      amount: r.amount as number,
      txnId: r.txn_id as string,
      sender: (r.sender_number as string | null) ?? null,
      shotUrl: r.screenshot_path ? (urls.get(r.screenshot_path as string) ?? null) : null,
      qa: Boolean(r.qa_code),
      status: r.status as ProofStatus,
      note: (r.note as string | null) ?? null,
      createdAt: new Date(r.created_at as string),
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string) : null,
      reviewer: reviewer?.name ?? null,
      payer: payer ? { id: payer.id, name: payer.name, email: payer.email ?? null, mobile: payer.mobile ?? null, role: payer.role } : null,
      contest: c ? { slug: c.slug, brand: c.brand_name, number: c.contest_number ?? null, status: c.status } : null,
      item: items.get(r.payment_id as string) ?? { addon: null, days: null },
    };
  });
}

export type ProofCounts = { pending: number; pendingSum: number; approvedToday: number; rejected30: number; approved: number; rejected: number };

export async function proofCounts(now = new Date()): Promise<ProofCounts> {
  const zero = { pending: 0, pendingSum: 0, approvedToday: 0, rejected30: 0, approved: 0, rejected: 0 };
  if (!isSupabaseConfigured()) return zero;
  const head = { count: "exact" as const, head: true };
  const dayStart = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(now) + "T00:00:00+06:00").toISOString();
  const month = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [p, today, rej30, appr, rej] = await Promise.all([
    db().from("manual_payments").select("amount").eq("status", "pending").limit(1000),
    db().from("manual_payments").select("id", head).eq("status", "approved").gte("reviewed_at", dayStart),
    db().from("manual_payments").select("id", head).eq("status", "rejected").gte("reviewed_at", month),
    db().from("manual_payments").select("id", head).eq("status", "approved"),
    db().from("manual_payments").select("id", head).eq("status", "rejected"),
  ]);
  if (p.error) return zero;
  return {
    pending: p.data?.length ?? 0,
    pendingSum: (p.data ?? []).reduce((a, r) => a + (r.amount as number), 0),
    approvedToday: today.count ?? 0,
    rejected30: rej30.count ?? 0,
    approved: appr.count ?? 0,
    rejected: rej.count ?? 0,
  };
}

export type QaCode = { code: string; createdAt: Date; usedAt: Date | null };

export async function qaCodes(limit = 30): Promise<QaCode[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await db().from("qa_txn_codes").select("code, created_at, used_at").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ code: r.code as string, createdAt: new Date(r.created_at as string), usedAt: r.used_at ? new Date(r.used_at as string) : null }));
}

// ---------------------------------------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------------------------------------

export type PromoRow = {
  id: string;
  code: string;
  audience: "client" | "designer";
  kind: PromoKind;
  value: number;
  mode: "single" | "shared";
  maxUses: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
  label: string | null;
  batchId: string | null;
  createdAt: Date;
  used: number;
  reserved: number;
};

/** A batch of one-time codes is one line; a shared code is one line. */
export type PromoLine = { key: string; batchId: string | null; codes: PromoRow[]; first: PromoRow; used: number; reserved: number; active: boolean };

export async function promoLines(): Promise<PromoLine[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await db()
    .from("promo_codes")
    .select("id, code, audience, kind, value, mode, max_uses, starts_at, ends_at, active, label, batch_id, created_at")
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error || !data) return [];
  const ids = data.map((r) => r.id as string);
  const uses = new Map<string, { used: number; reserved: number }>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data: reds } = await db().from("promo_redemptions").select("code_id, status").in("code_id", ids.slice(i, i + 300)).neq("status", "released");
    for (const r of reds ?? []) {
      const u = uses.get(r.code_id as string) ?? { used: 0, reserved: 0 };
      if (r.status === "used") u.used++;
      else u.reserved++;
      uses.set(r.code_id as string, u);
    }
  }
  const rows: PromoRow[] = data.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    audience: r.audience as PromoRow["audience"],
    kind: r.kind as PromoKind,
    value: r.value as number,
    mode: r.mode as PromoRow["mode"],
    maxUses: (r.max_uses as number | null) ?? null,
    startsAt: r.starts_at ? new Date(r.starts_at as string) : null,
    endsAt: r.ends_at ? new Date(r.ends_at as string) : null,
    active: Boolean(r.active),
    label: (r.label as string | null) ?? null,
    batchId: (r.batch_id as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    ...(uses.get(r.id as string) ?? { used: 0, reserved: 0 }),
  }));
  const lines = new Map<string, PromoLine>();
  for (const r of rows) {
    const key = r.batchId ?? r.id;
    const line = lines.get(key) ?? { key, batchId: r.batchId, codes: [], first: r, used: 0, reserved: 0, active: false };
    line.codes.push(r);
    line.used += r.used;
    line.reserved += r.reserved;
    line.active = line.active || r.active;
    lines.set(key, line);
  }
  return [...lines.values()];
}

/** One batch (or one code) as CSV: code, what it does, status, uses. */
export async function promoCsv(key: string): Promise<{ name: string; csv: string } | null> {
  const line = (await promoLines()).find((l) => l.key === key);
  if (!line) return null;
  const head = ["code", "audience", "kind", "value", "mode", "active", "used", "waiting", "starts_at", "ends_at", "label"];
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = line.codes.map((r) => [r.code, r.audience, r.kind, r.value, r.mode, r.active, r.used, r.reserved, r.startsAt?.toISOString() ?? "", r.endsAt?.toISOString() ?? "", r.label ?? ""].map(cell).join(","));
  return { name: `promo-codes-${line.first.code.split("-")[0].toLowerCase()}-${line.codes.length}.csv`, csv: [head.join(","), ...body].join("\n") + "\n" };
}
