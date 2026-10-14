import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrencyCode } from "@/lib/currency/rules";
import { paymentsAvailable } from "./index";
import { isManual, isMethodKey, METHOD_KEYS, methodCurrency, type MethodKey, type PublicMethod } from "./manual-rules";
import { stripeReady } from "./stripe-config";

/**
 * Payment methods (owner, 2026-10-14; Admin › Payments › Methods). Each has its own switch. A manual method is open
 * when it is on and has a number; an automatic one (bKash API, SSLCommerz) also needs its gateway to be set up.
 * Before migration 0050 there are no rows: no method is open (the old "payments open soon" message shows).
 */

export type MethodRow = {
  key: MethodKey;
  enabled: boolean;
  number: string | null;
  name: string | null;
  noteEn: string | null;
  noteBn: string | null;
  position: number;
  updatedAt: string | null;
};

export const methodRows = cache(async (): Promise<MethodRow[]> => {
  const { data, error } = await createAdminClient().from("payment_methods").select("key, enabled, account_number, account_name, note_en, note_bn, position, updated_at").order("position");
  if (error || !data) return [];
  return data
    .filter((r) => isMethodKey(r.key))
    .map((r) => ({
      key: r.key as MethodKey,
      enabled: Boolean(r.enabled),
      number: (r.account_number as string | null) ?? null,
      name: (r.account_name as string | null) ?? null,
      noteEn: (r.note_en as string | null) ?? null,
      noteBn: (r.note_bn as string | null) ?? null,
      position: (r.position as number) ?? 0,
      updatedAt: (r.updated_at as string | null) ?? null,
    }));
});

/** The gateway for an automatic method is set up on this server: Stripe needs its two keys (owner, 2026-10-14). */
export const gatewayReady = (key: MethodKey) => (key === "stripe" ? stripeReady() : !isManual(key) && paymentsAvailable());

/** Is this method open for paying right now? */
export function isOpen(r: MethodRow): boolean {
  if (!r.enabled) return false;
  return isManual(r.key) ? Boolean(r.number) : gatewayReady(r.key);
}

/** The methods people can pay with now, in the admin's order: Stripe for dollars, the others for taka. */
export async function openMethods(locale: "en" | "bn" = "en", currency: CurrencyCode = "BDT"): Promise<PublicMethod[]> {
  return (await methodRows())
    .filter((r) => isOpen(r) && methodCurrency(r.key) === currency)
    .map((r) => ({ key: r.key, manual: isManual(r.key), number: isManual(r.key) ? r.number : null, name: r.name, note: (locale === "bn" ? r.noteBn : r.noteEn) ?? r.noteEn }));
}

/** The method row if it is open now, else null. */
export async function openMethod(key: string): Promise<MethodRow | null> {
  if (!isMethodKey(key)) return null;
  const row = (await methodRows()).find((r) => r.key === key);
  return row && isOpen(row) ? row : null;
}

export const ALL_METHODS = METHOD_KEYS;
