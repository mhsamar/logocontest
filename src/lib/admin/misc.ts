import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** A-06 Payments, A-09 Homepage, A-10 Blocked terms, A-12 Audit log (BLUEPRINT §13). */

const PAGE = 40;

export type AdminPayment = {
  id: string;
  purpose: string;
  method: string;
  gateway: string;
  txnId: string | null;
  amount: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  contest: { slug: string; brand: string } | null;
  client: { id: string; name: string } | null;
};

export async function listPayments(q: { status: string; purpose: string; search: string; page: number }): Promise<{ rows: AdminPayment[]; total: number; pages: number; paidSum: number }> {
  if (!isSupabaseConfigured()) return { rows: [], total: 0, pages: 0, paidSum: 0 };
  const db = createAdminClient();
  let query = db
    .from("payments")
    .select("id, purpose, method, gateway, gateway_txn_id, amount, status, created_at, paid_at, contest:contests!contest_id(slug, brand_name), client:profiles!client_id(id, name)", { count: "exact" });
  if (["initiated", "paid", "failed"].includes(q.status)) query = query.eq("status", q.status);
  if (["contest", "extension", "addon"].includes(q.purpose)) query = query.eq("purpose", q.purpose);
  const term = q.search.trim().replace(/[%,()]/g, "");
  if (term) query = query.ilike("gateway_txn_id", `%${term}%`);
  const from = (q.page - 1) * PAGE;
  const [{ data, count }, paid] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE - 1),
    db.from("payments").select("amount").eq("status", "paid").limit(20000),
  ]);
  return {
    rows: (data ?? []).map((p) => {
      const c = one(p.contest as { slug: string; brand_name: string } | { slug: string; brand_name: string }[] | null);
      return {
        id: p.id as string,
        purpose: p.purpose as string,
        method: p.method as string,
        gateway: p.gateway as string,
        txnId: (p.gateway_txn_id as string | null) ?? null,
        amount: p.amount as number,
        status: p.status as string,
        createdAt: new Date(p.created_at as string),
        paidAt: p.paid_at ? new Date(p.paid_at as string) : null,
        contest: c ? { slug: c.slug, brand: c.brand_name } : null,
        client: one(p.client as { id: string; name: string } | { id: string; name: string }[] | null),
      };
    }),
    total: count ?? 0,
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
    paidSum: (paid.data ?? []).reduce((s, p) => s + (p.amount as number), 0),
  };
}

export type BlockedTerm = { id: number; term: string; language: string; type: string; createdAt: Date };

export async function listBlockedTerms(): Promise<BlockedTerm[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("blocked_terms").select("id, term, language, type, created_at").order("term");
  return (data ?? []).map((r) => ({ id: r.id as number, term: r.term as string, language: r.language as string, type: r.type as string, createdAt: new Date(r.created_at as string) }));
}

export type AuditRow = { id: string; action: string; subjectType: string; subjectId: string | null; changes: Record<string, unknown>; admin: string | null; createdAt: Date };

export async function listAudit(q: { action: string; page: number }): Promise<{ rows: AuditRow[]; pages: number; actions: string[] }> {
  if (!isSupabaseConfigured()) return { rows: [], pages: 0, actions: [] };
  const db = createAdminClient();
  let query = db.from("audit_logs").select("id, action, subject_type, subject_id, changes, created_at, admin:profiles!admin_id(name)", { count: "exact" });
  if (q.action) query = query.eq("action", q.action);
  const from = (q.page - 1) * PAGE;
  const [{ data, count }, kinds] = await Promise.all([query.order("created_at", { ascending: false }).range(from, from + PAGE - 1), db.from("audit_logs").select("action").limit(5000)]);
  return {
    rows: (data ?? []).map((r) => ({
      id: r.id as string,
      action: r.action as string,
      subjectType: r.subject_type as string,
      subjectId: (r.subject_id as string | null) ?? null,
      changes: (r.changes ?? {}) as Record<string, unknown>,
      admin: one(r.admin as { name: string } | { name: string }[] | null)?.name ?? null,
      createdAt: new Date(r.created_at as string),
    })),
    pages: Math.max(1, Math.ceil((count ?? 0) / PAGE)),
    actions: [...new Set((kinds.data ?? []).map((k) => k.action as string))].sort(),
  };
}

/** A-09: featured winning logos (in order) and the winning designs that could be added. */
export async function homepageLogos(): Promise<{ featured: { entryId: string; position: number }[]; candidates: string[] }> {
  if (!isSupabaseConfigured()) return { featured: [], candidates: [] };
  const db = createAdminClient();
  const [featured, winners] = await Promise.all([
    db.from("featured_logos").select("entry_id, position").order("position"),
    // Public winners only: not private, not NDA, and blind ones only once the client made the winner public.
    db
      .from("entries")
      .select("id, contest:contests!contest_id!inner(status, is_private, is_nda, is_blind, winner_is_public, completed_at)")
      .eq("status", "winner")
      .eq("contest.status", "completed")
      .eq("contest.is_private", false)
      .eq("contest.is_nda", false)
      .limit(200),
  ]);
  const taken = new Set((featured.data ?? []).map((f) => f.entry_id as string));
  const candidates = (winners.data ?? [])
    .filter((w) => {
      const c = one(w.contest as { is_blind: boolean; winner_is_public: boolean } | { is_blind: boolean; winner_is_public: boolean }[] | null);
      return c && (!c.is_blind || c.winner_is_public) && !taken.has(w.id as string);
    })
    .map((w) => w.id as string);
  return { featured: (featured.data ?? []).map((f) => ({ entryId: f.entry_id as string, position: f.position as number })), candidates };
}
