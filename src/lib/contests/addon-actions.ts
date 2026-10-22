"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { legacyMethod } from "@/lib/payments/manual-rules";
import { openMethod } from "@/lib/payments/methods";
import { activateFreeAddon, startAddonCheckout } from "./addon-payments";
import { isAddonKey } from "./addons";

/**
 * C-13b: buy an add-on or extension; the browser then goes to the gateway checkout, or for manual bKash (owner,
 * 2026-10-14) to the pay page. `method` is a method key from Admin › Payments › Methods.
 */
export async function buyAddon(input: { contestId: string; addon?: string; extensionDays?: number; method: string }): Promise<{ ok: true; redirectUrl: string; free?: boolean } | { ok: false; error: MessageKey }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status === "banned") return { ok: false, error: "auth.errors.generic" };
  const addon = input.addon && isAddonKey(input.addon) ? input.addon : null;
  const order = addon ? { addon } : typeof input.extensionDays === "number" ? { extensionDays: input.extensionDays } : null;
  if (!order) return { ok: false, error: "auth.errors.generic" };
  // Free with this prize (owner, 2026-10-22): switched on at once, no payment and no payment method needed.
  if (addon) {
    const free = await activateFreeAddon(user, input.contestId, addon);
    if (free.ok) {
      refresh();
      return { ok: true, redirectUrl: "", free: true };
    }
    if (free.error !== "not_free") return { ok: false, error: free.error === "closed" ? "manage.addons.closed" : free.error === "active" ? "manage.addons.alreadyActive" : free.error === "waiting" ? "manage.addons.waiting" : "auth.errors.generic" };
  }
  // The page showed it as free but the price changed since it loaded: ask for a reload instead of a payment error.
  if (!input.method) return { ok: false, error: "manage.addons.priceChanged" };
  const method = await openMethod(legacyMethod(input.method));
  if (!method) return { ok: false, error: "wizard.errors.paymentsClosed" };
  const res = await startAddonCheckout(user, input.contestId, order, method.key);
  if (res.ok) return res;
  return { ok: false, error: res.error === "closed" ? "manage.addons.closed" : res.error === "active" ? "manage.addons.alreadyActive" : "auth.errors.generic" };
}
