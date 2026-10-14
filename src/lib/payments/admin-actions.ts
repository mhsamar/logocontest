"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { adminUser, audit, cleanReason, UUID } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";
import { approveProof, rejectProof, type ApproveError } from "./manual";
import {
  CLIENT_FEE_CHOICES,
  DESIGNER_FEE_CHOICES,
  isManual,
  isMethodKey,
  normalizeMobile,
  normalizePromo,
  PROMO_CODE,
  qaCodeFrom,
  randomPromoCode,
  type PromoKind,
} from "./manual-rules";
import { gatewayReady } from "./methods";

/** Admin › Payments (owner, 2026-10-14): approvals, methods, QA transaction IDs and promo codes. */

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey) => ({ ok: false as const, error });
const db = () => createAdminClient();

const APPROVE_ERRORS: Record<ApproveError, MessageKey> = {
  notPending: "pay.admin.approvals.errors.notPending",
  amount: "pay.admin.approvals.errors.amount",
  notWaiting: "pay.admin.approvals.errors.notWaiting",
  generic: "pay.admin.approvals.errors.generic",
};

export async function approvePayment(id: string): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const res = await approveProof(id, admin.id);
  if (!res.ok) return fail(APPROVE_ERRORS[res.error]);
  refresh();
  return { ok: true };
}

export async function rejectPayment(id: string, f: Record<string, string>): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const res = await rejectProof(id, admin.id, reason.slice(0, 300));
  if (!res.ok) return fail(APPROVE_ERRORS[res.error]);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------------------------------------

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "") || null;

/** A method's number, name and notes. A manual method's number must be a Bangladesh mobile number. */
export async function saveMethod(key: string, f: { number?: string; name?: string; noteEn?: string; noteBn?: string }): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin || !isMethodKey(key)) return fail("auth.errors.generic");
  const raw = (f.number ?? "").trim();
  const number = raw ? normalizeMobile(raw) : null;
  if (raw && !number) return fail("pay.admin.methods.errors.number");
  const { data: before } = await db().from("payment_methods").select("enabled, account_number").eq("key", key).maybeSingle();
  if (isManual(key) && before?.enabled && !number) return fail("pay.admin.methods.errors.needsNumber");
  const row = { account_number: number, account_name: clean(f.name, 60), note_en: clean(f.noteEn, 300), note_bn: clean(f.noteBn, 300), updated_at: new Date().toISOString(), updated_by: admin.id };
  const { error } = await db().from("payment_methods").update(row).eq("key", key);
  if (error) return fail("pay.admin.methods.errors.generic");
  await audit(admin.id, "payment_method.save", "payment_method", null, { key, number: row.account_number, before: before?.account_number ?? null });
  refresh();
  return { ok: true };
}

/** The method's own switch. Manual: needs a number. Automatic: needs its gateway set up on the server. */
export async function setMethodEnabled(key: string, on: boolean): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin || !isMethodKey(key) || typeof on !== "boolean") return fail("auth.errors.generic");
  if (on) {
    if (isManual(key)) {
      const { data } = await db().from("payment_methods").select("account_number").eq("key", key).maybeSingle();
      if (!data?.account_number) return fail("pay.admin.methods.errors.needsNumber");
    } else if (!gatewayReady(key)) return fail("pay.admin.methods.errors.notReady");
  }
  const { error } = await db().from("payment_methods").update({ enabled: on, updated_at: new Date().toISOString(), updated_by: admin.id }).eq("key", key);
  if (error) return fail("pay.admin.methods.errors.generic");
  await audit(admin.id, on ? "payment_method.on" : "payment_method.off", "payment_method", null, { key });
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------
// QA transaction IDs
// ---------------------------------------------------------------------------------------------------------

/** Test transaction IDs for trying manual bKash without money (owner: "generate few transaction codes"). */
export async function makeQaCodes(n: number): Promise<{ ok: true; codes: string[] } | { ok: false; error: MessageKey }> {
  const admin = await adminUser("payments.manage");
  if (!admin) return fail("auth.errors.generic");
  const count = Math.max(1, Math.min(20, Math.floor(Number(n)) || 5));
  const codes = Array.from({ length: count }, () => qaCodeFrom(randomBytes(8)));
  const { error } = await db().from("qa_txn_codes").insert(codes.map((code) => ({ code, created_by: admin.id })));
  if (error) return fail("pay.admin.methods.errors.generic");
  await audit(admin.id, "qa_codes.make", "qa_txn_codes", null, { count });
  refresh();
  return { ok: true, codes };
}

// ---------------------------------------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------------------------------------

export type PromoInput = {
  audience: string;
  kind: string;
  value: number;
  mode: string;
  count?: number;
  prefix?: string;
  code?: string;
  maxUses?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  label?: string;
};

const KINDS: Record<string, PromoKind[]> = { client: ["client_fee"], designer: ["designer_fee", "pro_discount"] };
const PRO_DISCOUNTS = [10, 20, 25, 30, 40, 50, 75, 100];

/** The values a code of this kind may have: the owner's fee steps, or a Pro discount percent. */
const allowed = (kind: PromoKind): readonly number[] => (kind === "client_fee" ? CLIENT_FEE_CHOICES : kind === "designer_fee" ? DESIGNER_FEE_CHOICES : PRO_DISCOUNTS);

const when = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

/** Random one-time codes (a batch) or one shared code (once per account). */
export async function createPromoCodes(input: PromoInput): Promise<{ ok: true; codes: string[] } | { ok: false; error: MessageKey }> {
  const admin = await adminUser("payments.manage");
  if (!admin) return fail("auth.errors.generic");
  const kinds = KINDS[input.audience];
  if (!kinds || !(kinds as string[]).includes(input.kind)) return fail("pay.admin.promos.errors.generic");
  const kind = input.kind as PromoKind;
  const value = Number(input.value);
  if (!allowed(kind).includes(value)) return fail("pay.admin.promos.errors.value");
  const startsAt = when(input.startsAt);
  const endsAt = when(input.endsAt);
  if (startsAt === undefined || endsAt === undefined || (startsAt && endsAt && endsAt <= startsAt)) return fail("pay.admin.promos.errors.dates");
  const maxUses = input.maxUses ? Math.max(1, Math.floor(Number(input.maxUses))) : null;
  const base = { audience: input.audience, kind, value, starts_at: startsAt, ends_at: endsAt, label: clean(input.label, 60), created_by: admin.id };

  let rows: Record<string, unknown>[];
  if (input.mode === "single") {
    const count = Math.floor(Number(input.count));
    if (!(count >= 1 && count <= 500)) return fail("pay.admin.promos.errors.count");
    const batch = crypto.randomUUID();
    const prefix = (input.prefix ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    const codes = new Set<string>();
    while (codes.size < count) codes.add(randomPromoCode(randomBytes(8), prefix));
    rows = [...codes].map((code) => ({ ...base, code, mode: "single", max_uses: 1, batch_id: batch }));
  } else if (input.mode === "shared") {
    const code = normalizePromo(input.code ?? "");
    if (!PROMO_CODE.test(code)) return fail("pay.admin.promos.errors.code");
    rows = [{ ...base, code, mode: "shared", max_uses: maxUses }];
  } else return fail("pay.admin.promos.errors.generic");

  const { error } = await db().from("promo_codes").insert(rows);
  if (error) return fail(error.code === "23505" ? "pay.admin.promos.errors.taken" : "pay.admin.promos.errors.generic");
  await audit(admin.id, "promo.create", "promo_codes", null, { mode: input.mode, kind, value, count: rows.length, first: rows[0].code });
  refresh();
  return { ok: true, codes: rows.map((r) => r.code as string) };
}

/** Pause a code (or a whole batch) or turn it on again. */
export async function setPromoActive(target: { id?: string; batchId?: string }, active: boolean): Promise<Result> {
  const admin = await adminUser("payments.manage");
  if (!admin || typeof active !== "boolean") return fail("auth.errors.generic");
  const q = db().from("promo_codes").update({ active });
  const { error } = target.batchId && UUID.test(target.batchId) ? await q.eq("batch_id", target.batchId) : target.id && UUID.test(target.id) ? await q.eq("id", target.id) : { error: { message: "no target" } };
  if (error) return fail("pay.admin.promos.errors.generic");
  await audit(admin.id, active ? "promo.resume" : "promo.pause", "promo_codes", target.id ?? null, { batch: target.batchId ?? null });
  refresh();
  return { ok: true };
}
