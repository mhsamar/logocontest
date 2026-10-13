import "server-only";
import { translatorFor } from "@/lib/content/texts";
import { getEmailSender, siteOrigin } from "@/lib/email";
import { formatDate } from "@/lib/dates";
import type { NotificationData, NotificationType } from "@/lib/notifications";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, isProActive, periodEndAfterPayment, receiptCode, renewalReminderDue, shouldExpire, type FunnelEvent } from "./rules";
import { getProSettings } from "./settings";
import { SUB_COLUMNS, toSubscription, type Subscription } from "./status";

const db = () => createAdminClient();

/** Every change to the Pro plan (Admin › Pro plan › Activity log). actorId null = the system. Never throws. */
export async function logProActivity(actorId: string | null, action: string, designerId: string | null, oldValue: unknown, newValue: unknown): Promise<void> {
  const { error } = await db()
    .from("pro_activity_log")
    .insert({ actor_id: actorId, action, designer_id: designerId, old_value: oldValue ?? null, new_value: newValue ?? null });
  if (error) console.error("[pro] activity log:", error.message);
}

/** One step of the upgrade funnel. Never throws. */
export async function logFunnel(event: FunnelEvent, who: { designerId?: string | null; visitorId?: string | null; step?: string | null }): Promise<void> {
  const { ready } = await getProSettings();
  if (!ready) return;
  const { error } = await db()
    .from("pro_funnel_events")
    .insert({ event, designer_id: who.designerId ?? null, visitor_id: who.visitorId ?? null, step: who.step ?? null });
  if (error) console.error("[pro] funnel:", error.message);
}

/** In the app (bell + push) and by email, in the designer's own language. Never throws. */
export async function tellDesigner(designerId: string, type: NotificationType, data: NotificationData, link: string, mail?: { subject: string; body: string; params?: Record<string, string | number> }): Promise<void> {
  try {
    await notifyWithPush([designerId], type, data, link);
    if (!mail) return;
    const { data: p } = await db().from("profiles").select("email, name, locale").eq("id", designerId).maybeSingle();
    if (!p?.email) return;
    const t = await translatorFor(p.locale === "bn" ? "bn" : "en");
    const url = `${await siteOrigin()}${link}`;
    await getEmailSender().send({
      to: p.email as string,
      subject: t(mail.subject as never, mail.params),
      text: t(mail.body as never, { name: ((p.name as string | null) ?? "").trim(), link: url, ...mail.params }),
    });
  } catch (e) {
    console.error("[pro] tell designer:", e instanceof Error ? e.message : e);
  }
}

async function designerCounts(designerId: string): Promise<{ wins: number; entries: number }> {
  const [{ data: p }, { count }] = await Promise.all([
    db().from("profiles").select("wins_count").eq("id", designerId).maybeSingle(),
    db().from("entries").select("id", { count: "exact", head: true }).eq("designer_id", designerId),
  ]);
  return { wins: (p?.wins_count as number | null) ?? 0, entries: count ?? 0 };
}

/**
 * Turns Pro on or adds time: a paid month (from the current end when the plan is still running), a free month or a
 * trial from an admin. Clears a cancel. The "wins before" for Best results is taken when Pro starts.
 */
export async function grantPro(designerId: string, opts: { until?: Date; months?: number; days?: number; method: "bkash" | "card" | "free" | "trial"; priceBdt: number }): Promise<Subscription | null> {
  const now = new Date();
  const { data: existing } = await db().from("pro_subscriptions").select(SUB_COLUMNS).eq("designer_id", designerId).maybeSingle();
  const sub = existing ? toSubscription(existing as Record<string, unknown>) : null;
  const running = isProActive(sub, now);
  const base = running ? sub!.currentPeriodEnd : now;
  const end = opts.until ?? (opts.days ? new Date(base.getTime() + opts.days * 86_400_000) : periodEndAfterPayment(running ? sub!.currentPeriodEnd : null, now, opts.months ?? 1));
  const counts = running ? null : await designerCounts(designerId);
  const row = {
    designer_id: designerId,
    status: "active",
    price_bdt: opts.priceBdt,
    current_period_end: end.toISOString(),
    auto_renew: opts.method === "bkash" || opts.method === "card" ? true : (sub?.autoRenew ?? true),
    payment_method: opts.method,
    cancel_reason: null,
    cancel_note: null,
    cancelled_at: null,
    reminded_7d_at: null,
    reminded_1d_at: null,
    updated_at: now.toISOString(),
    ...(running ? {} : { started_at: now.toISOString(), wins_at_start: counts!.wins, entries_at_start: counts!.entries }),
    ...(sub ? {} : { first_started_at: now.toISOString() }),
  };
  const { data, error } = await db().from("pro_subscriptions").upsert(row, { onConflict: "designer_id" }).select(SUB_COLUMNS).single();
  if (error || !data) {
    console.error("[pro] grant:", error?.message);
    return null;
  }
  return toSubscription(data as Record<string, unknown>);
}

/** The designer cancels: Pro stays until the end date, then ends. One short reason is kept for Admin › Why they cancel. */
export async function cancelPro(designerId: string, reason: string, note: string | null, actorId: string | null): Promise<boolean> {
  const { data } = await db().from("pro_subscriptions").select(SUB_COLUMNS).eq("designer_id", designerId).maybeSingle();
  if (!data) return false;
  const sub = toSubscription(data as Record<string, unknown>);
  if (!isProActive(sub)) return false;
  const { error } = await db()
    .from("pro_subscriptions")
    .update({ status: "cancelled", auto_renew: false, cancel_reason: reason, cancel_note: note, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("designer_id", designerId);
  if (error) return false;
  await logFunnel("cancelled", { designerId, step: reason });
  await logProActivity(actorId, actorId === designerId ? "member_cancelled" : "admin_cancelled", designerId, { status: sub.status }, { status: "cancelled", reason, until: sub.currentPeriodEnd.toISOString() });
  await tellDesigner(designerId, "pro_cancelled", {}, "/dashboard/profile#subscription");
  return true;
}

/** The expiry job: plans whose period ended become expired (Pro features go away). Returns how many. */
export async function expireEndedPlans(now: Date = new Date()): Promise<number> {
  const { ready } = await getProSettings();
  if (!ready) return 0;
  const { data } = await db().from("pro_subscriptions").select(SUB_COLUMNS).neq("status", "expired").lte("current_period_end", now.toISOString());
  let n = 0;
  for (const r of data ?? []) {
    const sub = toSubscription(r as Record<string, unknown>);
    if (!shouldExpire(sub, now)) continue;
    const { data: done } = await db().from("pro_subscriptions").update({ status: "expired", updated_at: now.toISOString() }).eq("id", sub.id).neq("status", "expired").select("id");
    if (!done?.length) continue;
    n++;
    await logProActivity(null, "expired", sub.designerId, { status: sub.status }, { status: "expired" });
    await tellDesigner(sub.designerId, "pro_expired", {}, "/pro", { subject: "pro.mail.expired.subject", body: "pro.mail.expired.body" });
  }
  return n;
}

/**
 * Renewal (the site's payment gateway can't charge a saved bKash wallet or card every month): a reminder with a
 * one-tap pay link 7 days and 1 day before the end. A new price is mentioned here, so members hear about it at
 * least 7 days before it applies to them.
 */
export async function sendRenewalReminders(now: Date = new Date()): Promise<number> {
  const { ready, settings } = await getProSettings();
  if (!ready) return 0;
  const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const { data } = await db().from("pro_subscriptions").select(SUB_COLUMNS).in("status", ["active", "expiring", "payment_failed"]).gt("current_period_end", now.toISOString()).lte("current_period_end", soon);
  let n = 0;
  for (const r of data ?? []) {
    const sub = toSubscription(r as Record<string, unknown>);
    const due = renewalReminderDue(sub, now);
    if (!due) continue;
    const col = due === "7d" ? "reminded_7d_at" : "reminded_1d_at";
    const { data: claimed } = await db().from("pro_subscriptions").update({ [col]: now.toISOString(), status: sub.status === "active" ? "expiring" : sub.status }).eq("id", sub.id).is(col, null).select("id");
    if (!claimed?.length) continue;
    n++;
    const days = Math.max(1, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000));
    const changed = settings.priceBdt !== sub.priceBdt;
    await tellDesigner(sub.designerId, due === "7d" ? "pro_renew_7d" : "pro_renew_1d", { days, amount: settings.priceBdt }, "/pro/checkout?renew=1", {
      subject: due === "7d" ? "pro.mail.renew7.subject" : "pro.mail.renew1.subject",
      body: changed ? "pro.mail.renewNewPrice.body" : "pro.mail.renew.body",
      params: { days, amount: `৳${settings.priceBdt}`, old: `৳${sub.priceBdt}`, date: formatDate(sub.currentPeriodEnd, "en", "long") },
    });
  }
  if (n) await logProActivity(null, "renewal_reminders", null, null, { sent: n });
  return n;
}

/** Receipt by email and in the app, right after a payment (and on the Wallet as a PDF). */
export async function sendReceipt(designerId: string, receiptNo: number, amount: number, until: Date): Promise<void> {
  await tellDesigner(designerId, "pro_activated", { amount }, "/dashboard/wallet#receipts", {
    subject: "pro.mail.receipt.subject",
    body: "pro.mail.receipt.body",
    params: { receipt: receiptCode(receiptNo), amount: `৳${amount}`, date: formatDate(until, "en", "long") },
  });
}

/** For admin-made changes: a free month counts from the end when the plan is running. */
export const freeMonthEnd = (sub: Subscription | null, now: Date = new Date()) => addMonths(isProActive(sub, now) ? sub!.currentPeriodEnd : now, 1);
