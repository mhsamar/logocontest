"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { getFileStorage } from "@/lib/storage";
import { isManualKind, payTarget, PROOF_BUCKET, submitProof, type SubmitError } from "./manual";
import { isProofMethod, type ProofMethod } from "./manual-rules";

/** The pay page (owner, 2026-10-14): the payer's transaction ID and the optional screenshot. */

type Fail = { ok: false; error: MessageKey };
const fail = (error: MessageKey): Fail => ({ ok: false, error });

const SHOT_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const SHOT_MAX = 5 * 1024 * 1024;

const ERRORS: Record<SubmitError, MessageKey> = {
  txn: "pay.page.errors.txn",
  sender: "pay.page.errors.sender",
  shot: "pay.page.errors.shot",
  txnUsed: "pay.page.errors.txnUsed",
  bankRef: "pay.page.errors.bankRef",
  bank: "pay.page.errors.bank",
  senderNeeded: "pay.page.errors.senderNeeded",
  amount: "pay.page.errors.amount",
  shotNeeded: "pay.page.errors.shotNeeded",
  already: "pay.page.errors.already",
  closed: "pay.page.errors.closed",
  generic: "pay.page.errors.generic",
};

async function ownTarget(kind: string, paymentId: string) {
  if (!isSupabaseConfigured() || !isManualKind(kind)) return null;
  const user = await getCurrentUser();
  if (!user || user.status === "banned") return null;
  const target = await payTarget(kind, paymentId);
  return target && target.userId === user.id ? { user, target } : null;
}

/** A one-time upload link for the screenshot, in the payer's own folder of the private payment-proofs bucket. */
export async function preparePaymentProof(input: { kind: string; paymentId: string; type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  const own = await ownTarget(input.kind, input.paymentId);
  if (!own) return fail("pay.page.errors.generic");
  if (own.target.state !== "open") return fail("pay.page.errors.closed");
  const ext = SHOT_TYPES[input.type];
  if (!ext) return fail("pay.page.errors.shotType");
  if (!(input.size > 0) || input.size > SHOT_MAX) return fail("pay.page.errors.shotSize");
  const upload = await getFileStorage().createUploadUrl(PROOF_BUCKET, `${own.user.id}/${own.target.paymentId}-${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

/** Sends the transaction ID for an admin to check. The payer sees "Your payment is successful" and waits. */
export async function submitPaymentProof(input: { kind: string; paymentId: string; txnId: string; sender?: string; screenshotPath?: string | null; method?: ProofMethod; bank?: string | null; amountSent?: number | null; sentAround?: string | null }): Promise<{ ok: true } | Fail> {
  const own = await ownTarget(input.kind, input.paymentId);
  if (!own) return fail("pay.page.errors.generic");
  const shot = input.screenshotPath || null;
  if (shot && !(await getFileStorage().exists(PROOF_BUCKET, shot))) return fail("pay.page.errors.shot");
  const method = isProofMethod(input.method) ? input.method : "bkash";
  // The new ways to pay (owner, 2026-11-06) are for contest payments only; add-ons and Pro keep the bKash ID.
  if (method !== "bkash" && own.target.kind !== "contest") return fail("pay.page.errors.generic");
  const res = await submitProof(own.target, { txnId: input.txnId, sender: input.sender ?? null, screenshotPath: shot, method, bank: input.bank ?? null, amountSent: input.amountSent ?? null, sentAround: input.sentAround ?? null }, { id: own.user.id, name: own.user.name });
  if (!res.ok) return fail(ERRORS[res.error]);
  refresh();
  return { ok: true };
}
