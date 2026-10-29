import "server-only";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import type { NotificationData, NotificationType } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";
import { typeChannelOn } from "@/lib/notifications/switches";
import { awaitingApproval } from "@/lib/payments/manual";
import { MANUAL_METHODS } from "@/lib/payments/manual-rules";
import { notifyUser } from "@/lib/push";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkOrigin } from "@/lib/site-origin";
import { adminIdsWith } from "./recipients";
import { cleanRemindBy, DUE_GRACE_MS, followUpWays, inQuietHours, isDueSoon, isOverdueDay, scrubContacts, type AlertEvent } from "./unpaid-alert-rules";
import { AT_PAYMENT, dhakaMidnight, DRAFT_STAGE, stageOf } from "./unpaid-rules";

/**
 * Admin › Unpaid contests, phase 3 (owner, 2026-10-26; Design/unpaid-contests §2): the team's instant alerts. Each one
 * is a bell row for every admin it is for (they also pop up in the admin panel), and a push and an email by the team's
 * setting, except in quiet hours, when they only collect in the bell list. Never a phone number, in a row, a push, a
 * link or an email. Checked every 5 minutes (/api/cron/alerts) and in the 15-minute job; each alert goes once.
 */

type Row = Record<string, unknown>;
const H = 3_600_000;
const MISSING = /PGRST205|PGRST204|42P01|42703/;
const ROW_OF: Partial<Record<NotificationType, string>> = { followup_due_admin: "admin_followups", followup_overdue_admin: "admin_followups" };
export const leadLink = (key: string) => `/admin/unpaid?sel=${key}#lead`;
/** A brand or note as plain words: never a phone number or email (they reach bells, phones and pop-ups). */
const words = (v: unknown) => scrubContacts(String(v ?? "").replace(/\s+/g, " ").trim()) || "—";

// ---- Onboarding v2 (owner, 2026-10-29; migration 0079) ---------------------------------------------------------------

/** How far a contest of the new 4-step wizard (/start-v2) got; the old wizard's contests have no brief_completion. */
const V2_COLUMNS = "brief_completion, last_step, pricing_viewed_at, package_selected_at";
const NO_COLUMN = /PGRST204|42703/;
/** These columns plus onboarding v2's; `withV2` reads again without them before migration 0079. */
export const v2Columns = <C extends string>(columns: C, v2: boolean) => (v2 ? `${columns}, ${V2_COLUMNS}` : columns) as `${C}, ${typeof V2_COLUMNS}`;
export async function withV2<R extends { error: { code?: string } | null }>(read: (v2: boolean) => PromiseLike<R>): Promise<R> {
  const first = await read(true);
  // Before migration 0079 the columns don't exist yet: every contest is the old wizard's.
  return first.error && NO_COLUMN.test(`${first.error.code}`) ? read(false) : first;
}
const isV2 = (c: Row) => c.brief_completion != null;
/** On the payment step (or past it): last_step 4, or the payment opened. */
const atPayment = (c: Row) => Number(c.last_step) >= 4 || c.status === "pending_payment";
/**
 * The new wizard saves a draft at the logo name, long before the price (plan decision 8, owner 2026-10-29): the team's
 * alerts and the client's reminders start once they saw the prizes (step 3 also raises last_step, so a lost
 * pricing_viewed_at doesn't keep a client on the payment step from the team).
 */
export const beforePrizes = (c: Row) => isV2(c) && !c.pricing_viewed_at && (Number(c.last_step) || 0) < 3 && !atPayment(c);
/** `!beforePrizes` as a PostgREST filter (`.or`), so a read's limit counts only contests past it (needs migration 0079). */
export const PAST_PRIZES = "brief_completion.is.null,pricing_viewed_at.not.is.null,last_step.gte.3,status.eq.pending_payment";
/**
 * A v2 draft's amount is the starting package's until the client picks one or goes on to pay the one shown: not shown
 * before that (as on Admin › Unpaid contests).
 */
const amountOf = (c: Row) => (isV2(c) && !c.package_selected_at && !atPayment(c) ? undefined : ((c.total_amount as number | null) ?? undefined));
/** A v2 contest's last step on the team's 1..10 scale: logo name, prizes, payment step. */
const V2_STAGE: Record<number, number> = { 2: 2, 3: DRAFT_STAGE, 4: AT_PAYMENT };

async function alertSettings() {
  return getSettings(["notify.unpaid_alerts", "notify.followup_due_minutes", "notify.lead_alert_minutes", "notify.lead_alert_emails_day"]);
}

/** Emails to admins about unpaid contests today (they share the new-client alerts' daily number). */
async function emailsToday(now: Date): Promise<number> {
  const start = new Date(Math.floor((now.getTime() + 6 * H) / (24 * H)) * 24 * H - 6 * H).toISOString();
  const { count } = await createAdminClient().from("email_log").select("id", { count: "exact", head: true }).eq("template", "notification").like("ref", "unpaid%").eq("status", "sent").gte("created_at", start);
  return count ?? 0;
}

/**
 * One alert to these admins. `data` may depend on each admin's language (a reason in words). Returns how many got it.
 * `ways` overrides the team's push/email choice (a follow-up's "Remind me by").
 */
export async function sendUnpaidAlert(input: { event: AlertEvent; type: NotificationType; to: string[]; data: NotificationData | ((locale: Locale) => Promise<NotificationData> | NotificationData); link: string; ref: string; actorId?: string; ways?: { push: boolean; email: boolean }; now?: Date }): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const now = input.now ?? new Date();
  const s = await alertSettings();
  const alerts = s["notify.unpaid_alerts"];
  if (!alerts.events[input.event]) return 0;
  const ids = [...new Set(input.to)].filter((id) => id && id !== input.actorId);
  if (!ids.length) return 0;
  const db = createAdminClient();
  const { data: people } = await db.from("profiles").select("id, locale, email").in("id", ids).eq("role", "admin").eq("status", "active");
  if (!people?.length) return 0;
  const dataFor = async (locale: Locale) => (typeof input.data === "function" ? await input.data(locale) : input.data);
  const quiet = inQuietHours(alerts.quiet, now);
  const notice = ROW_OF[input.type] ?? "admin_unpaid";
  const ways = input.ways ?? { push: alerts.send.push, email: alerts.send.email };
  const [bell, push, email] = await Promise.all([typeChannelOn(input.type, "bell"), typeChannelOn(input.type, "push"), typeChannelOn(input.type, "email")]);
  // The bell list (and the pop-up, which reads it): always, also in quiet hours.
  const rows = await Promise.all(people.map(async (p) => ({ user_id: p.id as string, type: input.type, data: await dataFor(((p.locale as Locale) ?? "en") === "bn" ? "bn" : "en"), link: input.link })));
  if (bell) {
    const { error } = await db.from("notifications").insert(rows);
    if (error) console.error("[unpaid-alerts] bell:", error.message);
  }
  if (quiet) return people.length;
  const origin = await linkOrigin().catch(() => "");
  let emailsLeft = ways.email && email ? Math.max(0, s["notify.lead_alert_emails_day"] - (await emailsToday(now))) : 0;
  for (const p of people) {
    const locale: Locale = p.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(locale);
    const data = rows.find((r) => r.user_id === p.id)!.data;
    const text = renderNotification({ id: "-", type: input.type, data, link: input.link, read: false, createdAt: now }, t, locale, now).text;
    if (ways.push && push) await notifyUser(p.id as string, { title: t(`admin.unpaid.alerts.pop.${input.event}`), body: text, url: input.link });
    // Emails outlive the bell (deleted after 88 days), so they never name the person or the brand.
    if (emailsLeft > 0 && p.email) {
      emailsLeft--;
      await emailText({ notice, userId: p.id as string, locale, ref: `unpaid:${input.ref}`, subject: t(`admin.alerts.unpaid.${input.event}`), body: t("admin.alerts.unpaid.body", { what: t(`admin.alerts.unpaid.${input.event}`), link: `${origin}${input.link}` }) });
    }
  }
  return people.length;
}

/** Records an alert for a contest once; false when it was already sent. */
async function once(contestId: string, kind: string): Promise<boolean> {
  const { error } = await createAdminClient().from("lifecycle_events").insert({ contest_id: contestId, kind: kind.slice(0, 60) });
  return !error;
}

/**
 * The furthest step each draft reached: the old wizard's from its own visits (v2 visits count 1..5), else Prize (a draft
 * exists from there); a v2 draft's from the contest itself.
 */
async function stagesOf(contests: Row[]): Promise<Map<string, number>> {
  const ids = contests.filter((c) => !isV2(c)).map((c) => c.id as string);
  const read = (flow: boolean) => createAdminClient().from("wizard_visits").select((flow ? "contest_id, furthest_step, created_at, flow" : "contest_id, furthest_step, created_at") as "contest_id, furthest_step, created_at, flow").in("contest_id", ids);
  const { data } = ids.length ? await withV2(read) : { data: [] as Row[] };
  const best = new Map<string, number>();
  for (const v of data ?? []) if ((v.flow ?? "v1") === "v1") best.set(v.contest_id as string, Math.max(best.get(v.contest_id as string) ?? 0, stageOf(v.furthest_step as number, v.created_at as string)));
  return new Map(contests.map((c) => [c.id as string, c.status === "pending_payment" ? AT_PAYMENT : isV2(c) ? (V2_STAGE[Number(c.last_step)] ?? 2) : Math.min(Math.max(best.get(c.id as string) ?? DRAFT_STAGE, DRAFT_STAGE), AT_PAYMENT - 1)]));
}

/** Drafts the team has closed, hidden or blocked, and test clients: never alerted. */
async function skipped(contests: Row[]): Promise<Set<string>> {
  const db = createAdminClient();
  const ids = contests.map((c) => c.id as string);
  const clients = [...new Set(contests.map((c) => c.client_id as string).filter(Boolean))];
  const [leads, tests, waiting] = await Promise.all([
    ids.length ? db.from("unpaid_leads").select("contest_id, status, hidden, blocked").in("contest_id", ids) : Promise.resolve({ data: [] as Row[] }),
    clients.length ? db.from("profiles").select("id").in("id", clients).eq("is_test", true) : Promise.resolve({ data: [] as Row[] }),
    awaitingApproval(ids),
  ]);
  const test = new Set((tests.data ?? []).map((p) => p.id as string));
  const out = new Set<string>([...waiting.keys()]);
  for (const l of leads.data ?? []) if (l.status === "closed" || l.hidden || l.blocked) out.add(l.contest_id as string);
  for (const c of contests) if (test.has(c.client_id as string)) out.add(c.id as string);
  return out;
}

export type UnpaidAlertReport = { newUnpaid: number; failed: number; due: number; overdue: number };

/** Every check, each safe to run again. */
export async function runUnpaidAlerts(now = new Date()): Promise<UnpaidAlertReport> {
  const report: UnpaidAlertReport = { newUnpaid: 0, failed: 0, due: 0, overdue: 0 };
  if (!isSupabaseConfigured()) return report;
  const s = await alertSettings();
  const events = s["notify.unpaid_alerts"].events;
  if (events.new_unpaid) report.newUnpaid = await newUnpaid(now, s["notify.lead_alert_minutes"]);
  if (events.payment_failed) report.failed = await paymentFailed(now);
  if (events.followup_due || events.followup_overdue) Object.assign(report, await followUps(now, s["notify.followup_due_minutes"], events));
  return report;
}

/** "New unpaid contest": a saved draft with no activity for [15 min] (once per draft). Guests have their own alert. */
async function newUnpaid(now: Date, minutes: number): Promise<number> {
  const db = createAdminClient();
  const quietSince = new Date(now.getTime() - minutes * 60_000);
  // Only drafts that stopped recently: older ones were the team's to see on the page already.
  const { data: rows } = await withV2((v2) =>
    db
      .from("contests")
      .select(v2Columns("id, brand_name, total_amount, status, client_id, created_at, updated_at", v2))
      .in("status", ["draft", "pending_payment"])
      .lte("updated_at", quietSince.toISOString())
      .gte("updated_at", new Date(quietSince.getTime() - 3 * H).toISOString())
      .order("updated_at", { ascending: false })
      .limit(50),
  );
  // A v2 draft that hasn't reached the prizes: not yet (seeing them saves the contest, so it comes round again).
  const data = (rows ?? []).filter((c) => !beforePrizes(c));
  if (!data.length) return 0;
  // Still on Start a contest (or paying) right now: not stopped yet.
  const { data: live } = await db.from("wizard_live").select("contest_id, updated_at").in("contest_id", data.map((c) => c.id as string)).gt("updated_at", quietSince.toISOString());
  const active = new Set((live ?? []).map((l) => l.contest_id as string));
  const [skip, stages, viewers, told] = await Promise.all([skipped(data), stagesOf(data), adminIdsWith("unpaid.view"), clientsToldToday(data, now)]);
  let sent = 0;
  for (const c of data) {
    const id = c.id as string;
    // One alert a day per client, however many drafts they save.
    if (active.has(id) || skip.has(id) || told.has(c.client_id as string)) continue;
    if (!(await once(id, "unpaid_alert"))) continue;
    told.add(c.client_id as string);
    const key = `c:${id}`;
    await sendUnpaidAlert({ event: "new_unpaid", type: "unpaid_new_admin", to: viewers, data: { brand: words(c.brand_name), step: stages.get(id), amount: amountOf(c), lead: key }, link: leadLink(key), ref: key, now });
    sent++;
  }
  return sent;
}

/** Clients whose drafts already made a "New unpaid contest" alert in the last day. */
async function clientsToldToday(contests: Row[], now: Date): Promise<Set<string>> {
  const db = createAdminClient();
  const clients = [...new Set(contests.map((c) => c.client_id as string).filter(Boolean))];
  if (!clients.length) return new Set();
  const { data: drafts } = await db.from("contests").select("id, client_id").in("client_id", clients).gte("created_at", new Date(now.getTime() - 7 * 24 * H).toISOString());
  const ids = (drafts ?? []).map((d) => d.id as string);
  const { data: told } = ids.length ? await db.from("lifecycle_events").select("contest_id").in("contest_id", ids).eq("kind", "unpaid_alert").gte("created_at", new Date(now.getTime() - 24 * H).toISOString()) : { data: [] as Row[] };
  const owner = new Map((drafts ?? []).map((d) => [d.id as string, d.client_id as string]));
  return new Set((told ?? []).map((t) => owner.get(t.contest_id as string)).filter((v): v is string => Boolean(v)));
}

/**
 * "Payment failed": a card payment that didn't go through, or a bKash payment the team couldn't approve (with why). A
 * manual bKash payment row marked failed is not one: the new wizard closes an outdated one that way when the client
 * changes the package or a code (v2-actions closeOpenPayments); a rejected bKash payment comes from its proof.
 */
async function paymentFailed(now: Date): Promise<number> {
  const db = createAdminClient();
  const since = new Date(now.getTime() - 2 * H).toISOString();
  const [cards, proofs] = await Promise.all([
    db.from("payments").select("id, contest_id, updated_at").eq("purpose", "contest").eq("status", "failed").not("gateway", "in", `(${MANUAL_METHODS.join(",")})`).gte("updated_at", since).limit(30),
    db.from("manual_payments").select("id, contest_id, note, reviewed_by").eq("kind", "contest").eq("status", "rejected").gte("reviewed_at", since).limit(30),
  ]);
  const failures = [
    ...(cards.data ?? []).map((p) => ({ id: p.id as string, contestId: p.contest_id as string, kind: "payfail", note: null as string | null, actor: undefined as string | undefined })),
    ...(proofs.data ?? []).map((p) => ({ id: p.id as string, contestId: p.contest_id as string, kind: "proofrej", note: (p.note as string | null) ?? null, actor: (p.reviewed_by as string | null) ?? undefined })),
  ].filter((f) => f.contestId);
  if (!failures.length) return 0;
  const { data: contests } = await withV2((v2) => db.from("contests").select(v2Columns("id, brand_name, total_amount, status, client_id", v2)).in("id", [...new Set(failures.map((f) => f.contestId))]));
  const open = (contests ?? []).filter((c) => (c.status === "draft" || c.status === "pending_payment") && !beforePrizes(c));
  const [skip, viewers] = await Promise.all([skipped(open), adminIdsWith("unpaid.view")]);
  let sent = 0;
  for (const f of failures) {
    const c = open.find((x) => x.id === f.contestId);
    if (!c || skip.has(f.contestId) || !(await once(f.contestId, `${f.kind}:${f.id}`))) continue;
    const key = `c:${f.contestId}`;
    const data = async (locale: Locale) => ({ brand: words(c.brand_name), amount: amountOf(c), lead: key, reason: f.note ? words(f.note) : (await translatorFor(locale))("admin.unpaid.alerts.reasons.card") });
    await sendUnpaidAlert({ event: "payment_failed", type: "unpaid_failed_admin", to: viewers, data, link: leadLink(key), ref: key, actorId: f.actor, now });
    sent++;
  }
  return sent;
}

/**
 * "Follow-up is due" ([10 min] before, or just missed) and "Follow-up overdue" (planned for the day that just ended), to
 * the person who owns it. Not for a contest that was paid or waits for a bKash check, or a hidden or blocked lead.
 * Overdue waits for the end of quiet hours, so it can pop up and reach the phone.
 */
async function followUps(now: Date, dueMinutes: number, events: { followup_due: boolean; followup_overdue: boolean }): Promise<{ due: number; overdue: number }> {
  const db = createAdminClient();
  const columns = "id, kind, contest_id, guest_mobile, brand_snapshot, owner_id, next_followup_at, remind_by, due_alerted_for, overdue_alerted_for, hidden, blocked";
  const alerts = (await alertSettings())["notify.unpaid_alerts"];
  const quiet = inQuietHours(alerts.quiet, now);
  const [due, overdue] = await Promise.all([
    events.followup_due ? db.from("unpaid_leads").select(columns).neq("status", "closed").gt("next_followup_at", new Date(now.getTime() - DUE_GRACE_MS).toISOString()).lte("next_followup_at", new Date(now.getTime() + dueMinutes * 60_000).toISOString()).limit(100) : Promise.resolve({ data: [] as Row[], error: null }),
    events.followup_overdue && !quiet ? db.from("unpaid_leads").select(columns).neq("status", "closed").gte("next_followup_at", dhakaMidnight(now, -1).toISOString()).lt("next_followup_at", dhakaMidnight(now).toISOString()).limit(200) : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  // Before migration 0078 there is nowhere to mark them: nothing is sent.
  const error = due.error ?? overdue.error;
  if (error) {
    if (!MISSING.test(`${error.code}`)) console.error("[unpaid-alerts] follow-ups:", error.message);
    return { due: 0, overdue: 0 };
  }
  const leads = [...new Map([...(due.data ?? []), ...(overdue.data ?? [])].map((l) => [l.id as string, l])).values()].filter((l) => !l.hidden && !l.blocked);
  if (!leads.length) return { due: 0, overdue: 0 };
  // A contest that was paid, or waits for a bKash check, needs no follow-up alert.
  const contestIds = leads.map((l) => l.contest_id as string | null).filter((v): v is string => Boolean(v));
  const [{ data: contests }, waiting, managers] = await Promise.all([
    contestIds.length ? db.from("contests").select("id, status").in("id", contestIds) : Promise.resolve({ data: [] as Row[] }),
    awaitingApproval(contestIds),
    adminIdsWith("unpaid.manage"),
  ]);
  const open = new Set((contests ?? []).filter((c) => c.status === "draft" || c.status === "pending_payment").map((c) => c.id as string));
  let dueCount = 0;
  let overdueCount = 0;
  for (const l of leads) {
    if (l.contest_id && (!open.has(l.contest_id as string) || waiting.has(l.contest_id as string))) continue;
    const at = l.next_followup_at as string;
    const when = new Date(at);
    const kind = events.followup_due && isDueSoon(when, now, dueMinutes) ? "due" : events.followup_overdue && !quiet && isOverdueDay(when, now) ? "overdue" : null;
    if (!kind) continue;
    const column = kind === "due" ? "due_alerted_for" : "overdue_alerted_for";
    if (l[column] && new Date(l[column] as string).getTime() === when.getTime()) continue;
    // Claimed first (this exact planned time), so two runs never both send it.
    const { data: claimed } = await db.from("unpaid_leads").update({ [column]: at }).eq("id", l.id as string).eq("next_followup_at", at).or(`${column}.is.null,${column}.neq.${JSON.stringify(at)}`).select("id");
    if (!claimed?.length) continue;
    const key = await leadKeyOf(l);
    const owner = l.owner_id && managers.includes(l.owner_id as string) ? [l.owner_id as string] : managers;
    const remindBy = cleanRemindBy(l.remind_by);
    await sendUnpaidAlert({
      event: kind === "due" ? "followup_due" : "followup_overdue",
      type: kind === "due" ? "followup_due_admin" : "followup_overdue_admin",
      to: owner,
      // "Remind me by" without Admin alert: no pop-up either (the bell still keeps it).
      data: { brand: words(l.brand_snapshot), minutes: Math.max(1, Math.round((when.getTime() - now.getTime()) / 60_000)), lead: key, ...(remindBy && !remindBy.includes("alert") ? { pop: false } : {}) },
      link: leadLink(key),
      ref: key,
      ways: followUpWays(alerts.send, remindBy),
      now,
    });
    if (kind === "due") dueCount++;
    else overdueCount++;
  }
  return { due: dueCount, overdue: overdueCount };
}

/** A lead's key on the page: its draft, a visit of the guest's number, or the lead itself. Never the number. */
async function leadKeyOf(l: Row): Promise<string> {
  if (l.contest_id) return `c:${l.contest_id}`;
  if (l.guest_mobile) {
    const { data } = await createAdminClient().from("wizard_leads").select("visit_id").eq("mobile", l.guest_mobile as string).order("updated_at", { ascending: false }).limit(1);
    if (data?.[0]?.visit_id) return `g:${data[0].visit_id}`;
  }
  return `l:${l.id}`;
}

// ---- From Start a contest (the live route, after its answer is sent) ------------------------------------------------------

/** "Someone is creating a contest now": a new visit on Start a contest (off by default). */
export async function alertCreating(visitId: string, stage: number, now = new Date()): Promise<void> {
  // At most one every 2 minutes for the whole team, so a busy hour (or a script) can't flood the bells and phones.
  if (!(await getSettings(["notify.unpaid_alerts"]))["notify.unpaid_alerts"].events.creating_now) return;
  const { data: recent } = await createAdminClient().from("notifications").select("id").eq("type", "unpaid_live_admin").gt("created_at", new Date(now.getTime() - 2 * 60_000).toISOString()).limit(1);
  if (recent?.length) return;
  const viewers = await adminIdsWith("unpaid.view");
  await sendUnpaidAlert({ event: "creating_now", type: "unpaid_live_admin", to: viewers, data: { step: stage }, link: "/admin/unpaid#live", ref: `v:${visitId}`, now });
}

/** "They came back": a client opens their unpaid draft again after they had stopped (once a day per draft). */
export async function alertCameBack(contestId: string, now = new Date()): Promise<void> {
  const db = createAdminClient();
  const minutes = (await alertSettings())["notify.lead_alert_minutes"];
  const { data: c } = await withV2((v2) => db.from("contests").select(v2Columns("id, brand_name, total_amount, status, client_id, created_at, updated_at", v2)).eq("id", contestId).maybeSingle());
  if (!c || (c.status !== "draft" && c.status !== "pending_payment") || beforePrizes(c)) return;
  // They had stopped: the draft hadn't changed for [15 min].
  if (now.getTime() - Date.parse(c.updated_at as string) < minutes * 60_000) return;
  const [skip, stages] = await Promise.all([skipped([c]), stagesOf([c])]);
  const day = new Date(now.getTime() + 6 * H).toISOString().slice(0, 10);
  if (skip.has(contestId) || !(await once(contestId, `back:${day}`))) return;
  const key = `c:${contestId}`;
  await sendUnpaidAlert({ event: "came_back", type: "unpaid_back_admin", to: await adminIdsWith("unpaid.view"), data: { brand: words(c.brand_name), step: stages.get(contestId), amount: amountOf(c), lead: key }, link: leadLink(key), ref: key, now });
}
