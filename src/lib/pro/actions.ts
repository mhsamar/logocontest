"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n/translate";
import { getPaymentGateway, paymentsAvailable } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProActive, priceQuote } from "./rules";
import { getProSettings } from "./settings";
import { getSubscription } from "./status";
import { cancelPro, grantPro, logFunnel, logProActivity } from "./subscription";

type Fail = { ok: false; error: MessageKey };
const fail = (error: MessageKey): Fail => ({ ok: false, error });

async function designer() {
  const user = await getCurrentUser();
  return user && user.role === "designer" && user.status === "active" ? user : null;
}

/**
 * Upgrade to Pro (or renew): the price is worked out here from Admin › Pro plan (offer, promo code, free trial),
 * never taken from the browser. A free trial turns Pro on at once; otherwise a pending payment is made and the
 * designer goes to the gateway's secure page. Refused while the plan is not for sale.
 */
export async function startProCheckout(input: { method: "bkash" | "card"; promo?: string; acceptedTerms: boolean }): Promise<{ ok: true; redirectUrl: string } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  const { settings, ready } = await getProSettings();
  if (!ready || !settings.isForSale) return fail("pro.errors.notForSale");
  if (!input.acceptedTerms) return fail("pro.errors.terms");
  if (input.method !== "bkash" && input.method !== "card") return fail("pro.errors.generic");

  const sub = await getSubscription(user.id);
  const quote = priceQuote(settings, { firstTime: !sub, promo: input.promo ?? null });
  if (input.promo && input.promo.trim() && quote.reason !== "promo") return fail("pro.errors.promo");

  if (quote.reason === "trial") {
    const granted = await grantPro(user.id, { days: quote.trialDays, method: "trial", priceBdt: settings.priceBdt });
    if (!granted) return fail("pro.errors.generic");
    await logFunnel("paid", { designerId: user.id, step: "trial" });
    await logProActivity(null, "trial_started", user.id, null, { days: quote.trialDays });
    refresh();
    return { ok: true, redirectUrl: "/pro/checkout?status=success&trial=1" };
  }

  if (!paymentsAvailable()) return fail("pro.errors.paymentsClosed");
  const { data: payment, error } = await createAdminClient()
    .from("pro_payments")
    .insert({
      designer_id: user.id,
      subscription_id: sub?.id ?? null,
      kind: sub && isProActive(sub) ? "renewal" : "new",
      amount_bdt: quote.amount,
      method: input.method,
      provider: getPaymentGateway().name,
      promo_code: quote.reason === "promo" ? settings.promoCode : null,
    })
    .select("id")
    .single();
  if (error || !payment) return fail("pro.errors.generic");
  await logFunnel("payment_started", { designerId: user.id, step: input.method });
  try {
    const { redirectUrl } = await getPaymentGateway().createCheckout({
      paymentId: payment.id as string,
      amount: quote.amount,
      method: input.method,
      description: "logocontest.bd Pro · 1 month",
      customer: { name: user.name, mobile: user.mobile },
    });
    return { ok: true, redirectUrl };
  } catch {
    await createAdminClient().from("pro_payments").update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", payment.id);
    await logFunnel("payment_failed", { designerId: user.id, step: "gateway" });
    return fail("pro.errors.payment");
  }
}

const REASONS = ["too_expensive", "not_enough_wins", "one_contest", "payment_problem", "other"] as const;

/** Cancel Pro (Settings › Subscription): one short reason; Pro stays until the end date. */
export async function cancelMyPro(input: { reason: string; note?: string }): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  if (!(REASONS as readonly string[]).includes(input.reason)) return fail("pro.errors.reason");
  const note = (input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || null;
  if (!(await cancelPro(user.id, input.reason, note, user.id))) return fail("pro.errors.generic");
  refresh();
  return { ok: true };
}

/** The Go Pro card folded into its pill (or opened again), remembered for this designer on every device. */
export async function setProCardMinimised(minimised: boolean): Promise<void> {
  const user = await designer();
  const { ready } = await getProSettings();
  if (!user || !ready) return;
  await createAdminClient().from("pro_preferences").upsert({ designer_id: user.id, card_minimised: minimised === true, updated_at: new Date().toISOString() }, { onConflict: "designer_id" });
}

const PREF_KEYS = ["show_badge", "client_messages", "weekly_report", "show_contact", "alert_app", "alert_email", "similar_alerts"] as const;
type PrefKey = (typeof PREF_KEYS)[number];

/** Pro extras switches (Settings) and the alert switches (Contests). Pro designers only. */
export async function setProPreference(key: PrefKey, on: boolean): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  if (!(PREF_KEYS as readonly string[]).includes(key) || typeof on !== "boolean") return fail("pro.errors.generic");
  if (!isProActive(await getSubscription(user.id))) return fail("pro.errors.proOnly");
  const { error } = await createAdminClient().from("pro_preferences").upsert({ designer_id: user.id, [key]: on, updated_at: new Date().toISOString() }, { onConflict: "designer_id" });
  if (error) return fail("pro.errors.generic");
  refresh();
  return { ok: true };
}

const UUID = /^[0-9a-f-]{36}$/i;

/** Profile cover (up to 12) and pinned featured work (up to 6): the designer's own designs only. */
export async function setProPicks(input: { cover?: string[]; featured?: string[]; title?: string }): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  if (!isProActive(await getSubscription(user.id))) return fail("pro.errors.proOnly");
  const cover = input.cover ? [...new Set(input.cover.filter((x) => UUID.test(x)))].slice(0, 12) : undefined;
  const featured = input.featured ? [...new Set(input.featured.filter((x) => UUID.test(x)))].slice(0, 6) : undefined;
  const ids = [...(cover ?? []), ...(featured ?? [])];
  if (ids.length) {
    const { data } = await createAdminClient().from("entries").select("id").in("id", ids).eq("designer_id", user.id);
    const own = new Set((data ?? []).map((r) => r.id as string));
    if (!ids.every((x) => own.has(x))) return fail("pro.errors.generic");
  }
  const title = input.title === undefined ? undefined : input.title.replace(/\s+/g, " ").trim().slice(0, 60) || null;
  const row: Record<string, unknown> = { designer_id: user.id, updated_at: new Date().toISOString() };
  if (cover) row.cover_entry_ids = cover;
  if (featured) row.featured_entry_ids = featured;
  if (title !== undefined) row.title = title;
  const { error } = await createAdminClient().from("pro_preferences").upsert(row, { onConflict: "designer_id" });
  if (error) return fail("pro.errors.generic");
  refresh();
  return { ok: true };
}

/** Pro: remind me before a saved contest ends (24 hours and 2 hours before). */
export async function setSavedReminder(contestId: string, on: boolean): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user || !UUID.test(contestId)) return fail("pro.errors.generic");
  if (!isProActive(await getSubscription(user.id))) return fail("pro.errors.proOnly");
  const { error } = await createAdminClient().from("contest_favorites").update({ remind: on === true }).eq("user_id", user.id).eq("contest_id", contestId);
  if (error) return fail("pro.errors.generic");
  refresh();
  return { ok: true };
}

/** Pro "Instant alerts": which design types to hear about (empty = all). Only known service slugs are kept. */
export async function setProAlertServices(services: string[]): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  if (!isProActive(await getSubscription(user.id))) return fail("pro.errors.proOnly");
  const list = [...new Set((Array.isArray(services) ? services : []).filter((x) => typeof x === "string" && /^[a-z][a-z0-9_]{1,39}$/.test(x)))].slice(0, 40);
  const { error } = await createAdminClient().from("pro_preferences").upsert({ designer_id: user.id, alert_services: list, updated_at: new Date().toISOString() }, { onConflict: "designer_id" });
  if (error) return fail("pro.errors.generic");
  refresh();
  return { ok: true };
}

const PORTFOLIO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const PORTFOLIO_MAX = 10 * 1024 * 1024;

/** Pro portfolio (own designs, not contest designs): a one-time upload link while slots are left. */
export async function preparePortfolioUpload(input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  if (!isProActive(await getSubscription(user.id))) return fail("pro.errors.proOnly");
  const ext = PORTFOLIO_TYPES[input.type];
  if (!ext || !(input.size > 0 && input.size <= PORTFOLIO_MAX)) return fail("pro.errors.generic");
  const { settings } = await getProSettings();
  const { count } = await createAdminClient().from("portfolio_items").select("id", { count: "exact", head: true }).eq("designer_id", user.id);
  if ((count ?? 0) >= settings.proPortfolioLimit) return fail("pro.errors.slotsFull");
  const { randomUUID } = await import("node:crypto");
  const path = `portfolio/${user.id}/${randomUUID()}.${ext}`;
  const { getFileStorage } = await import("@/lib/storage");
  const up = await getFileStorage().createUploadUrl("pro-files", path);
  return { ok: true, path: up.path, token: up.token };
}

/** Saves an uploaded portfolio design: checked as an image, a preview made, and counted against the slots. */
export async function addPortfolioItem(input: { path: string; title: string }): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user) return fail("pro.errors.designersOnly");
  if (!isProActive(await getSubscription(user.id))) return fail("pro.errors.proOnly");
  if (!new RegExp(`^portfolio/${user.id}/[0-9a-f-]{36}\\.(png|jpg|webp)$`).test(input.path)) return fail("pro.errors.generic");
  const { settings } = await getProSettings();
  const db = createAdminClient();
  const { count } = await db.from("portfolio_items").select("id", { count: "exact", head: true }).eq("designer_id", user.id);
  const { getFileStorage } = await import("@/lib/storage");
  const store = getFileStorage();
  if ((count ?? 0) >= settings.proPortfolioLimit) {
    await store.remove("pro-files", [input.path]).catch(() => undefined);
    return fail("pro.errors.slotsFull");
  }
  let preview: Uint8Array;
  try {
    const sharp = (await import("sharp")).default;
    const bytes = await store.download("pro-files", input.path);
    preview = new Uint8Array(await sharp(bytes).rotate().resize(900, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
  } catch {
    await store.remove("pro-files", [input.path]).catch(() => undefined);
    return fail("pro.errors.badImage");
  }
  const previewPath = input.path.replace(/\.(png|jpg|webp)$/, ".preview.webp");
  await store.upload("pro-files", previewPath, preview, "image/webp");
  const title = (input.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const { error } = await db.from("portfolio_items").insert({ designer_id: user.id, title, image_path: input.path, preview_path: previewPath, position: count ?? 0 });
  if (error) return fail("pro.errors.generic");
  refresh();
  return { ok: true };
}

export async function removePortfolioItem(id: string): Promise<{ ok: true } | Fail> {
  const user = await designer();
  if (!user || !UUID.test(id)) return fail("pro.errors.generic");
  const db = createAdminClient();
  const { data } = await db.from("portfolio_items").delete().eq("id", id).eq("designer_id", user.id).select("image_path, preview_path");
  const row = data?.[0];
  if (row) {
    const { getFileStorage } = await import("@/lib/storage");
    await getFileStorage().remove("pro-files", [row.image_path as string, row.preview_path as string]).catch(() => undefined);
  }
  refresh();
  return { ok: true };
}
