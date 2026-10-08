"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { startAddonCheckout } from "./addon-payments";
import { isAddonKey } from "./addons";

/** C-13b: buy an add-on or extension; the browser then goes to the gateway checkout. */
export async function buyAddon(input: { contestId: string; addon?: string; extensionDays?: number; method: "bkash" | "card" }): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: MessageKey }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status !== "active") return { ok: false, error: "auth.errors.generic" };
  if (input.method !== "bkash" && input.method !== "card") return { ok: false, error: "auth.errors.generic" };
  const order = input.addon && isAddonKey(input.addon) ? { addon: input.addon } : typeof input.extensionDays === "number" ? { extensionDays: input.extensionDays } : null;
  if (!order) return { ok: false, error: "auth.errors.generic" };
  const res = await startAddonCheckout(user, input.contestId, order, input.method);
  if (res.ok) return res;
  return { ok: false, error: res.error === "closed" ? "manage.addons.closed" : res.error === "active" ? "manage.addons.alreadyActive" : "auth.errors.generic" };
}
