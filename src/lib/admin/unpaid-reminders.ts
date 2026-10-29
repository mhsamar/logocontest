import "server-only";
import { isRealEmail } from "@/lib/admin/reminder-rules";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import { isSupabaseConfigured } from "@/lib/env";
import { noticeOn } from "@/lib/notifications/switches";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkOrigin } from "@/lib/site-origin";
import { resumeLink } from "@/lib/contests/resume";
import { clientHour, reminderDue, remindersStopped, REPLY_RESULTS } from "./unpaid-alert-rules";
import { beforePrizes, PAST_PRIZES, v2Columns, withV2 } from "./unpaid-alerts";

/**
 * Admin › Unpaid contests, phase 3 (owner, 2026-10-26; Design/unpaid-contests §9): automatic reminders to a client who
 * saved a contest but didn't pay. The first email [1 hour] after their last activity, the last one (with an offer of
 * help, off by default) after [48 hours], before the Trash. Only signed-up clients with a saved draft (owner,
 * 2026-10-26), between 8 am and 10 pm; never once they paid, are waiting for a bKash check, replied (help chat, their own
 * support message, or the team talked to them), or the team closed or stopped the lead; each client can unsubscribe from
 * these alone. SMS waits for an SMS provider. The reminders don't count as the team's follow-ups.
 *
 * Kept small so nobody can use them to send mail: one reminder at a time per client (their newest draft), none if one
 * went to them in the last day, at most 10 a run and 30% of the site's daily email limit. If any check can't be read,
 * nothing is sent that run (never an email to someone who should be left alone).
 */

type Row = Record<string, unknown>;
const H = 3_600_000;
const PER_RUN = 10;

/** Bangladesh midnight of this day. */
const dhakaDay = (now: Date) => new Date(Math.floor((now.getTime() + 6 * H) / (24 * H)) * 24 * H - 6 * H);

export async function runUnpaidReminders(now = new Date()): Promise<number> {
  if (!isSupabaseConfigured() || !clientHour(now)) return 0;
  const s = await getSettings(["notify.unpaid_reminders", "notify.unpaid_reminder_first_hours", "notify.unpaid_reminder_last_hours", "trash.unpaid_hours", "contact.phone", "email.daily_limit"]);
  const on = s["notify.unpaid_reminders"];
  if ((!on.first && !on.last) || !(await noticeOn("unpaid_reminders", "email"))) return 0;
  const db = createAdminClient();
  const lastHours = s["notify.unpaid_reminder_last_hours"];

  // Today's share of the site's emails (the rest stay for contests, payments and the team).
  const limit = s["email.daily_limit"];
  const { count: today, error: countError } = await db.from("email_log").select("id", { count: "exact", head: true }).eq("template", "contest-reminder").eq("status", "sent").gte("created_at", dhakaDay(now).toISOString());
  if (countError) return 0;
  let budget = Math.min(PER_RUN, (limit > 0 ? Math.floor(limit * 0.3) : 100) - (today ?? 0));
  if (budget <= 0) return 0;

  // Onboarding v2 saves a draft at the logo name: no reminder before the client saw the prizes (owner, 2026-10-29). Left
  // out before the limit, so many new v2 drafts can't push an older due draft out of the 200.
  const { data: rows, error } = await withV2((v2) => {
    const read = db
      .from("contests")
      .select(v2Columns("id, brand_name, status, client_id, created_at, updated_at", v2))
      .in("status", ["draft", "pending_payment"])
      .gte("created_at", new Date(now.getTime() - (lastHours + 24) * H).toISOString());
    return (v2 ? read.or(PAST_PRIZES) : read).order("created_at", { ascending: false }).limit(200);
  });
  const contests = (rows ?? []).filter((c) => !beforePrizes(c));
  if (error || !contests.length) return 0;
  const ids = contests.map((c) => c.id as string);
  const [sent, live] = await Promise.all([
    db.from("lifecycle_events").select("contest_id, kind").in("contest_id", ids).like("kind", "remind_%"),
    db.from("wizard_live").select("contest_id, updated_at").in("contest_id", ids),
  ]);
  if (sent.error || live.error) return 0;
  const done = new Set((sent.data ?? []).map((e) => `${e.contest_id}:${e.kind}`));
  // What each draft is due now; then each client's newest due draft only.
  const due = new Map<string, { c: Row; kind: "first" | "last" }>();
  for (const c of contests) {
    const id = c.id as string;
    if (due.has(c.client_id as string)) continue;
    const lastLive = Math.max(0, ...(live.data ?? []).filter((l) => l.contest_id === id).map((l) => Date.parse(l.updated_at as string)));
    const kind = reminderDue({
      createdAt: new Date(c.created_at as string),
      lastActivity: new Date(Math.max(Date.parse(c.updated_at as string), lastLive)),
      now,
      firstHours: s["notify.unpaid_reminder_first_hours"],
      lastHours,
      trashHours: s["trash.unpaid_hours"],
      sent: { first: done.has(`${id}:remind_first`), last: done.has(`${id}:remind_last`) },
      on,
    });
    if (kind) due.set(c.client_id as string, { c, kind });
  }
  if (!due.size) return 0;

  // Everything that stops a reminder, for these clients only. Any of it unreadable: nothing goes this run.
  const clients = [...due.keys()];
  const dueIds = [...due.values()].map((d) => d.c.id as string);
  const [people, proofs, leads, offersByContest, offersByClient, threads, recent] = await Promise.all([
    db.from("profiles").select("id, email, mobile, locale, role, status, deleted_at, email_off").in("id", clients),
    db.from("manual_payments").select("contest_id").in("contest_id", dueIds).eq("status", "pending"),
    db.from("unpaid_leads").select("id, contest_id, status, stop_reminders, hidden, blocked").in("contest_id", dueIds),
    db.from("help_offers").select("contest_id, user_id, status").in("contest_id", dueIds),
    db.from("help_offers").select("contest_id, user_id, status").in("user_id", clients),
    db.from("support_threads").select("id, user_id").in("user_id", clients),
    db.from("email_log").select("user_id").in("user_id", clients).eq("template", "contest-reminder").eq("status", "sent").gte("created_at", new Date(now.getTime() - 24 * H).toISOString()),
  ]);
  const failed = [people, proofs, leads, offersByContest, offersByClient, threads, recent].find((r) => r.error);
  if (failed) {
    console.error("[unpaid-reminders] stopped this run:", failed.error?.message);
    return 0;
  }
  const leadIds = (leads.data ?? []).map((l) => l.id as string);
  const threadIds = (threads.data ?? []).map((th) => th.id as string);
  const values = (people.data ?? []).flatMap((p) => [p.mobile as string | null, ((p.email as string | null) ?? "").trim().toLowerCase() || null].filter((v): v is string => Boolean(v)));
  const [talked, ownMessages, blocks] = await Promise.all([
    leadIds.length ? db.from("lead_activities").select("lead_id").in("lead_id", leadIds).in("result", [...REPLY_RESULTS]) : Promise.resolve({ data: [] as Row[], error: null }),
    // Only what the client wrote themselves (not the team's replies, broadcasts or the assistant).
    threadIds.length ? db.from("support_messages").select("thread_id, created_at").in("thread_id", threadIds).eq("from_admin", false).gte("created_at", new Date(now.getTime() - (lastHours + 24) * H).toISOString()) : Promise.resolve({ data: [] as Row[], error: null }),
    values.length ? db.from("blocked_contacts").select("kind, value").in("value", values).is("lifted_at", null) : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  if (talked.error || ownMessages.error || (blocks.error && !/PGRST205|42P01/.test(`${blocks.error.code}`))) return 0;

  const person = new Map((people.data ?? []).map((p) => [p.id as string, p]));
  const waiting = new Set((proofs.data ?? []).map((m) => m.contest_id as string));
  const leadOf = new Map((leads.data ?? []).map((l) => [l.contest_id as string, l]));
  const talkedTo = new Set((talked.data ?? []).map((a) => a.lead_id as string));
  const offers = [...(offersByContest.data ?? []), ...(offersByClient.data ?? [])];
  const threadOwner = new Map((threads.data ?? []).map((th) => [th.id as string, th.user_id as string]));
  const remindedToday = new Set((recent.data ?? []).map((r) => r.user_id as string));
  const blocked = new Set((blocks.data ?? []).map((b) => `${b.kind}:${b.value}`));
  const origin = await linkOrigin().catch(() => "");
  let count = 0;
  for (const [clientId, { c, kind: due1 }] of due) {
    if (budget <= 0) break;
    const id = c.id as string;
    const p = person.get(clientId);
    if (!p || p.role !== "client" || p.status !== "active" || p.deleted_at || !isRealEmail(p.email as string | null) || remindedToday.has(clientId)) continue;
    // Unsubscribed from these: skipped, and never marked as sent.
    if (Array.isArray(p.email_off) && (p.email_off as string[]).includes("contest-reminder")) continue;
    const lead = leadOf.get(id);
    const created = Date.parse(c.created_at as string);
    const replied =
      (lead && talkedTo.has(lead.id as string)) ||
      offers.some((o) => (o.contest_id === id || o.user_id === clientId) && (o.status === "replied" || o.status === "call_me")) ||
      (ownMessages.data ?? []).some((m) => threadOwner.get(m.thread_id as string) === clientId && Date.parse(m.created_at as string) > created);
    const email = ((p.email as string) ?? "").trim().toLowerCase();
    const stopped = remindersStopped({
      status: c.status as string,
      awaitingApproval: waiting.has(id),
      lead: lead ? { status: lead.status as string, stop: Boolean(lead.stop_reminders), hidden: Boolean(lead.hidden), blocked: Boolean(lead.blocked) } : null,
      replied: Boolean(replied),
      blockedContact: blocked.has(`email:${email}`) || Boolean(p.mobile && blocked.has(`mobile:${p.mobile}`)),
    });
    if (stopped) continue;
    const kind = `remind_${due1}`;
    // Claimed first, so two runs never both send it.
    const { error: claimError } = await db.from("lifecycle_events").insert({ contest_id: id, kind });
    if (claimError) continue;
    budget--;
    const locale = p.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(locale);
    const brand = ((c.brand_name as string) || "").replace(/\s+/g, " ").trim().slice(0, 60) || t("email.reminder.yourContest");
    const status = await emailText({
      key: "contest-reminder",
      userId: clientId,
      locale,
      notice: "unpaid_reminders",
      ref: `remind:${id}:${due1}`,
      buttonKey: "email.reminder.button",
      subject: t(`email.reminder.${due1}.subject`),
      body: t(`email.reminder.${due1}.body`, { brand, link: await resumeLink(id, now, locale === "bn" ? "bn" : "en").catch(() => `${origin}/client/contests/${id}`), phone: s["contact.phone"] }),
    });
    if (status === "sent") {
      count++;
      continue;
    }
    // Held back by the daily limit: again on a later run. A failed send: once more, then not again.
    const retried = done.has(`${id}:${kind}_retry`);
    if (status === "skipped" || !retried) {
      await db.from("lifecycle_events").delete().eq("contest_id", id).eq("kind", kind);
      if (status === "failed") await db.from("lifecycle_events").insert({ contest_id: id, kind: `${kind}_retry` });
    }
  }
  return count;
}
