import "server-only";
import { unstable_cache } from "next/cache";
import type { CurrencyCode } from "@/lib/currency/rules";
import { isSupabaseConfigured } from "@/lib/env";
import type { MethodKey } from "@/lib/payments/manual-rules";
import { openMethods } from "@/lib/payments/methods";

/**
 * The payment methods open in this currency, for the home page's "bKash or card" wording (owner, 2026-10-29: card only
 * while a card method is on). Shared by every visitor for a minute (owner, 2026-10-28: the home page must not ask the
 * database on every visit), so a switch in Admin › Payments shows within a minute.
 */
export const homePayMethods = unstable_cache(
  async (currency: CurrencyCode): Promise<MethodKey[]> => (isSupabaseConfigured() ? (await openMethods("en", currency)).map((m) => m.key) : []),
  ["home-pay-methods-v1"],
  { revalidate: 60 },
);
