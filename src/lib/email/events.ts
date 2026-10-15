import "server-only";
import { translatorFor } from "@/lib/content/texts";
import { requireEnv, isSupabaseConfigured } from "@/lib/env";
import { SHOWN_STATUSES } from "@/lib/entries/rules";
import { certNumber, type Verdict } from "@/lib/logo-check/rules";
import { getService } from "@/lib/services/store";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutFor } from "@/lib/wallet/fees";
import { chatEmailDue, digestDue, spanText, taka } from "./catalog";
import { imageToken } from "./links";
import { previewOf } from "./render";
import { emailOrigin, lastSent, sendEmail, type SendStatus } from "./send";

/**
 * Which event sends which email (owner, 2026-10-15; Design/emails/EMAILS-HANDOFF.md). Each function loads what its
 * email shows and calls sendEmail(), which checks the person's Email settings and logs the send. None of them throws:
 * an email that fails never stops what the person was doing.
 */

const db = () => createAdminClient();
const ENTRY_FILES_BUCKET = "entry-files";
const IMAGE_DAYS = 120;

const safe = async <T,>(what: string, run: () => Promise<T>): Promise<T | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    return await run();
  } catch (e) {
    console.error(`[email] ${what}:`, e instanceof Error ? e.message : e);
    return null;
  }
};

/** "16 Oct 2026, 9:00 pm" in Dhaka time. */
export const emailDate = (d: Date, withTime = true) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}), timeZone: "Asia/Dhaka" }).format(d);

/** A design's picture for an email: a signed link to a JPEG at most `width` wide (never the storage itself). */
async function entryImageUrl(origin: string, previewPath: string | null | undefined, width: number): Promise<string> {
  if (!previewPath) return "";
  const exp = Math.floor(Date.now() / 1000) + IMAGE_DAYS * 86_400;
  return `${origin}/api/email/image/${imageToken(requireEnv("OTP_SECRET"), { bucket: ENTRY_FILES_BUCKET, path: previewPath, width, exp })}`;
}

const firstPreview = (images: unknown) => ([...((images as { position: number; preview_path: string }[] | null) ?? [])].sort((a, b) => a.position - b.position)[0]?.preview_path ?? null);

type ContestCard = { id: string; slug: string; clientId: string; title: string; hidden: boolean; type: string; prize: number; endsAt: Date | null; status: string };

async function contestCard(contestId: string): Promise<ContestCard | null> {
  const { data: c } = await db().from("contests").select("id, slug, client_id, brand_name, prize_amount, ends_at, is_private, is_nda, contest_number, service, status").eq("id", contestId).maybeSingle();
  if (!c) return null;
  const hidden = Boolean(c.is_private || c.is_nda);
  const number = c.contest_number ? ` LC-${String(c.contest_number).padStart(4, "0")}` : "";
  const service = await getService(c.service as string | null).catch(() => null);
  return {
    id: c.id as string,
    slug: c.slug as string,
    clientId: c.client_id as string,
    // Private and NDA contests never show the brand by email either.
    title: hidden ? `Private contest${number}` : (c.brand_name as string),
    hidden,
    type: service?.name.en ?? "Logo design",
    prize: (c.prize_amount as number) ?? 0,
    endsAt: c.ends_at ? new Date(c.ends_at as string) : null,
    status: c.status as string,
  };
}

/** The variables of the contest box several emails share. */
const cardData = (origin: string, c: ContestCard) => ({
  contest_title: c.title,
  contest_type: c.type,
  prize: taka(c.prize),
  end_date: c.endsAt ? emailDate(c.endsAt) : "",
  contest_url: `${origin}/contest/${c.slug}`,
  contest_image_url: `${origin}/api/email/contest/${c.slug}`,
});

// ---- Account ----------------------------------------------------------------------------------------------------------

/** Account created (client or designer). */
export async function emailWelcome(userId: string): Promise<void> {
  await safe("welcome", async () => {
    const origin = await emailOrigin();
    await sendEmail({ key: "welcome", to: { userId }, data: { dashboard_url: `${origin}/dashboard` }, ref: "welcome" });
  });
}

// ---- Designers --------------------------------------------------------------------------------------------------------

/**
 * A new contest. Pro designers hear first, during early access (`headStartMinutes`), with the Pro note; the others
 * when it opens to everyone.
 */
export async function emailContestNew(contestId: string, designerIds: string[], pro: { headStartMinutes: number } | null): Promise<number> {
  return (
    (await safe("contest-new", async () => {
      if (!designerIds.length) return 0;
      const c = await contestCard(contestId);
      if (!c) return 0;
      const origin = await emailOrigin();
      const data = { ...cardData(origin, c), pro: Boolean(pro), head_start: pro ? spanText(pro.headStartMinutes) : "" };
      let sent = 0;
      const notice = pro ? "contest_new_pro" : "contest_new";
      for (const id of [...new Set(designerIds)]) if ((await sendEmail({ key: "contest-new", to: { userId: id }, data, ref: `contest:${c.id}`, notice })) === "sent") sent++;
      return sent;
    })) ?? 0
  );
}

/** Active designers who should hear about a new contest by email, leaving out these (Pro designers told earlier). */
export async function designersForAlert(except: string[]): Promise<string[]> {
  const { data } = await db().from("profiles").select("id").eq("role", "designer").eq("status", "active").is("deleted_at", null);
  const ids = (data ?? []).map((r) => r.id as string).filter((id) => !except.includes(id));
  // Which designers get it by email is set only in Admin › Notifications (owner, 2026-10-15).
  return ids;
}

/** A client invited these Pro designers. */
export async function emailInvite(contestId: string, designerIds: string[]): Promise<void> {
  await safe("contest-invite", async () => {
    const c = await contestCard(contestId);
    if (!c || !designerIds.length) return;
    const origin = await emailOrigin();
    const data = { ...cardData(origin, c), client_name: c.hidden ? "A client" : c.title, reminder_time: "24 hours" };
    for (const id of designerIds) await sendEmail({ key: "contest-invite", to: { userId: id }, data, ref: `invite:${c.id}` });
  });
}

/** "X hours left": to designers who sent a design or saved the contest. */
export async function emailContestEnding(contestId: string, hours: number): Promise<number> {
  return (
    (await safe("contest-ending", async () => {
      const c = await contestCard(contestId);
      if (!c) return 0;
      const [{ data: entries }, { data: saved }] = await Promise.all([
        db().from("entries").select("designer_id").eq("contest_id", c.id).in("status", SHOWN_STATUSES),
        db().from("contest_favorites").select("user_id").eq("contest_id", c.id),
      ]);
      const mine = new Map<string, number>();
      for (const e of entries ?? []) mine.set(e.designer_id as string, (mine.get(e.designer_id as string) ?? 0) + 1);
      const savedIds = (saved ?? []).map((r) => r.user_id as string);
      const { data: designers } = savedIds.length ? await db().from("profiles").select("id").in("id", savedIds).eq("role", "designer") : { data: [] };
      const to = [...new Set([...mine.keys(), ...(designers ?? []).map((d) => d.id as string)])];
      const origin = await emailOrigin();
      let sent = 0;
      for (const id of to) {
        const data = { ...cardData(origin, c), contest_url: `${origin}/contest/${c.slug}/submit`, hours_left: spanText(hours * 60), entry_count: entries?.length ?? 0, my_entry_count: mine.get(id) ?? 0 };
        if ((await sendEmail({ key: "contest-ending", to: { userId: id }, data, ref: `ending:${c.id}:${hours}` })) === "sent") sent++;
      }
      return sent;
    })) ?? 0
  );
}

type EntryInfo = { id: string; number: number; designerId: string; preview: string | null; contest: ContestCard };

async function entryInfo(entryId: string): Promise<EntryInfo | null> {
  const { data: e } = await db().from("entries").select("id, number, designer_id, contest_id, images:entry_images!entry_id(position, preview_path)").eq("id", entryId).maybeSingle();
  if (!e) return null;
  const contest = await contestCard(e.contest_id as string);
  return contest ? { id: e.id as string, number: e.number as number, designerId: e.designer_id as string, preview: firstPreview(e.images), contest } : null;
}

/** The client shortlisted a design (once per design, even if it is taken off and put back). */
export async function emailShortlisted(entryId: string): Promise<void> {
  await safe("entry-shortlisted", async () => {
    const e = await entryInfo(entryId);
    if (!e || (await lastSent(e.designerId, "entry-shortlisted", `shortlist:${e.id}`))) return;
    const origin = await emailOrigin();
    await sendEmail({
      key: "entry-shortlisted",
      to: { userId: e.designerId },
      ref: `shortlist:${e.id}`,
      data: { entry_no: e.number, contest_title: e.contest.title, entry_image_url: await entryImageUrl(origin, e.preview, 1056), contest_url: `${origin}/contest/${e.contest.slug}?tab=entries&entry=${e.number}` },
    });
  });
}

/** The designer won: prize, the fee of their own fee step (locked when the winner was picked) and what they get. */
export async function emailWon(entryId: string): Promise<void> {
  await safe("contest-won", async () => {
    const e = await entryInfo(entryId);
    if (!e) return;
    const { data: h } = await db().from("handovers").select("prize, fee_rate").eq("entry_id", e.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const prize = (h?.prize as number | null) ?? e.contest.prize;
    const rate = (h?.fee_rate as number | null) ?? 0;
    const { fee, credit } = payoutFor(prize, rate);
    const origin = await emailOrigin();
    await sendEmail({
      key: "contest-won",
      to: { userId: e.designerId },
      ref: `won:${e.contest.id}`,
      data: {
        entry_no: e.number,
        contest_title: e.contest.title,
        entry_image_url: await entryImageUrl(origin, e.preview, 1056),
        prize: taka(prize),
        fee_percent: rate,
        fee_amount: taka(fee),
        payout_amount: taka(credit),
        handover_url: `${origin}/dashboard/handover/${e.contest.slug}`,
      },
    });
  });
}

// ---- Clients ----------------------------------------------------------------------------------------------------------

/** The contest ended: pick a winner within the judging days. */
export async function emailPickWinner(contestId: string, pickDays: number): Promise<void> {
  await safe("client-pick-winner", async () => {
    const c = await contestCard(contestId);
    if (!c) return;
    const { count } = await db().from("entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id).in("status", SHOWN_STATUSES);
    const origin = await emailOrigin();
    await sendEmail({
      key: "client-pick-winner",
      to: { userId: c.clientId },
      ref: `pick:${c.id}`,
      data: { ...cardData(origin, c), contest_title: c.title, entry_count: count ?? 0, pick_days: pickDays, contest_url: `${origin}/dashboard/contests/${c.slug}` },
    });
  });
}

/**
 * The daily digest of new designs (lifecycle job): each open contest's client, at most once a day per contest and only
 * when designs came in since the last one. Returns how many were sent.
 */
export async function sendClientDigests(now: Date = new Date()): Promise<number> {
  return (
    (await safe("client-new-entries", async () => {
      const { data: contests } = await db().from("contests").select("id, client_id, starts_at").in("status", ["open", "judging"]).is("deleted_at", null);
      // At most one per contest in this many hours (Admin › Notifications; 24 = once a day).
      const gapHours = (await getSettings(["timers.new_entry_digest_hours"]))["timers.new_entry_digest_hours"];
      let sent = 0;
      for (const row of contests ?? []) {
        const ref = `digest:${row.id}`;
        const last = await lastSent(row.client_id as string, "client-new-entries", ref);
        const since = last ?? (row.starts_at ? new Date(row.starts_at as string) : new Date(0));
        const { data: fresh } = await db()
          .from("entries")
          .select("id, created_at, images:entry_images!entry_id(position, preview_path)")
          .eq("contest_id", row.id)
          .in("status", SHOWN_STATUSES)
          .gt("created_at", since.toISOString())
          .order("created_at", { ascending: false });
        if (!digestDue(last, fresh?.length ?? 0, now, gapHours * 3_600_000)) continue;
        const c = await contestCard(row.id as string);
        if (!c) continue;
        const [{ count: total }, { count: checked }] = await Promise.all([
          db().from("entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id).in("status", SHOWN_STATUSES),
          db().from("entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id).in("status", SHOWN_STATUSES).not("check_id", "is", null),
        ]);
        const origin = await emailOrigin();
        const pictures = await Promise.all((fresh ?? []).slice(0, 3).map((e) => entryImageUrl(origin, firstPreview(e.images), 336)));
        const status = await sendEmail({
          key: "client-new-entries",
          to: { userId: c.clientId },
          ref,
          data: {
            new_count: fresh!.length,
            contest_title: c.title,
            entry_1_image_url: pictures[0] ?? "",
            entry_2_image_url: pictures[1] ?? "",
            entry_3_image_url: pictures[2] ?? "",
            entry_count: total ?? 0,
            checked_count: checked ?? 0,
            end_date: c.endsAt ? emailDate(c.endsAt) : "",
            contest_url: `${origin}/dashboard/contests/${c.slug}`,
          },
        });
        if (status === "sent") sent++;
      }
      return sent;
    })) ?? 0
  );
}

// ---- Everyone ---------------------------------------------------------------------------------------------------------

/**
 * A new chat message between a client and a designer (Pro messages, comments on a design, the files chat): at most
 * one email per conversation every 30 minutes, so a quick back-and-forth is one email.
 */
export async function emailChat(input: { to: string; senderName: string; contestId: string; entryNo: number | null; message: string; path: string; thread: string; notice: string }): Promise<SendStatus | null> {
  return safe("chat-message", async () => {
    // The gap is set in Admin › Notifications (30 minutes at first).
    const minutes = (await getSettings(["notify.chat_email_minutes"]))["notify.chat_email_minutes"];
    if (!chatEmailDue(await lastSent(input.to, "chat-message", input.thread), new Date(), minutes * 60_000)) return "skipped";
    const c = await contestCard(input.contestId);
    const origin = await emailOrigin();
    const text = input.message.replace(/\s+/g, " ").trim();
    return sendEmail({
      key: "chat-message",
      to: { userId: input.to },
      ref: input.thread,
      notice: input.notice,
      data: {
        sender_name: input.senderName,
        contest_title: c?.title ?? "your contest",
        entry_no: input.entryNo ?? "",
        message_preview: text.length > 160 ? `${text.slice(0, 159).trimEnd()}…` : text || "(file)",
        chat_url: `${origin}${input.path}`,
      },
    });
  });
}

const LEVEL: Record<Verdict, string> = { no_match: "No close match", similar: "Similar logos found", high_risk: "High risk" };

/** A logo check finished (not the quick check a designer runs while sending a design: they are on the page). */
export async function emailCheckReady(checkId: string): Promise<void> {
  await safe("logo-check-ready", async () => {
    const { data: k } = await db()
      .from("logo_checks")
      .select("id, number, source, status, verdict, sources, finished_at, requested_by, contest_id, entry:entries!entry_id(number)")
      .eq("id", checkId)
      .maybeSingle();
    if (!k || k.status !== "done" || k.source === "pre_submit" || !k.requested_by) return;
    const sources = k.sources as { shape?: { closest?: number } } | null;
    const verdict = (k.verdict as Verdict | null) ?? "no_match";
    const entry = (Array.isArray(k.entry) ? k.entry[0] : k.entry) as { number: number } | null;
    let checksLeft = "";
    if (k.source === "designer") {
      const { designerCheckUsage } = await import("@/lib/pro/logo-checks");
      checksLeft = String((await designerCheckUsage(k.requested_by as string)).left);
    }
    const origin = await emailOrigin();
    await sendEmail({
      key: "logo-check-ready",
      to: { userId: k.requested_by as string },
      ref: `check:${k.id}`,
      data: {
        match_level: LEVEL[verdict] ?? LEVEL.no_match,
        match_percent: sources?.shape?.closest ?? 0,
        file_name: entry ? `Entry #${entry.number}` : "your logo",
        report_id: certNumber(k.number as number),
        checked_at: emailDate(k.finished_at ? new Date(k.finished_at as string) : new Date()),
        checks_left: checksLeft,
        report_url: `${origin}/dashboard/logo-checks`,
      },
    });
  });
}

// ---- Pro plan ---------------------------------------------------------------------------------------------------------

const METHOD: Record<string, string> = { bkash: "bKash", card: "Card", nagad: "Nagad", rocket: "Rocket", free: "Free", trial: "Free trial" };

export async function emailProReceipt(designerId: string, receipt: string, amount: number, until: Date, method: string): Promise<void> {
  await safe("pro-receipt", async () => {
    const origin = await emailOrigin();
    await sendEmail({
      key: "pro-receipt",
      to: { userId: designerId },
      ref: `receipt:${receipt}`,
      data: { receipt_no: receipt, amount: taka(amount), payment_method: METHOD[method] ?? method, period_end: emailDate(until, false), dashboard_url: `${origin}/dashboard` },
    });
  });
}

export async function emailProRenewal(designerId: string, days: number, until: Date, amount: number): Promise<void> {
  await safe("pro-renewal", async () => {
    const { designerCheckUsage } = await import("@/lib/pro/logo-checks");
    const usage = await designerCheckUsage(designerId);
    const month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
    const { count: wins } = await db().from("handovers").select("id", { count: "exact", head: true }).eq("designer_id", designerId).gte("created_at", month);
    const origin = await emailOrigin();
    await sendEmail({
      key: "pro-renewal",
      to: { userId: designerId },
      ref: `renewal:${until.toISOString().slice(0, 10)}:${days}`,
      data: {
        days_left: days,
        period_end: emailDate(until, false),
        amount: taka(amount),
        checks_used: usage.used,
        checks_limit: usage.limit,
        wins_month: wins ?? 0,
        renew_url: `${origin}/pro/checkout?renew=1`,
        manage_url: `${origin}/dashboard/profile#subscription`,
      },
    });
  });
}

// ---- Everything else: notification.html -------------------------------------------------------------------------------

/**
 * Any other email (owner, 2026-10-15): a title, the text, and a button. The text may already greet the person in
 * their own language; then the template's "Hi …," is left out. Security emails always go and have no Unsubscribe.
 */
export async function emailNotification(input: {
  to: { userId?: string | null; email?: string; name?: string | null };
  title: string;
  body: string;
  buttonText?: string;
  buttonUrl?: string;
  security?: boolean;
  ref?: string;
  greets?: boolean;
  /** Its row in Admin › Notifications. */
  notice?: string;
}): Promise<SendStatus> {
  const origin = await emailOrigin().catch(() => "");
  // The first link to this site in the text becomes the button when none is given.
  const link = input.buttonUrl ?? input.body.match(/https?:\/\/\S+/g)?.find((u) => !origin || u.startsWith(origin))?.replace(/[.,;:!?)]+$/, "");
  return sendEmail({
    key: "notification",
    to: input.to,
    security: input.security,
    ref: input.ref,
    notice: input.notice,
    data: {
      title: input.title,
      body: input.body,
      preview: previewOf(input.body),
      button_text: link ? (input.buttonText ?? "Open logocontest.bd") : "",
      button_url: link ?? "",
      ...(input.greets === false ? {} : { first_name: "" }),
    },
  });
}

/** A text email written in the person's language (from the site texts) as notification.html. */
export async function emailText(input: {
  userId?: string | null;
  email?: string;
  locale: "en" | "bn";
  subject: string;
  body: string;
  buttonKey?: string;
  security?: boolean;
  ref?: string;
  notice?: string;
}): Promise<SendStatus> {
  const t = await translatorFor(input.locale);
  return emailNotification({
    to: { userId: input.userId, email: input.email },
    title: input.subject,
    body: input.body,
    buttonText: t((input.buttonKey ?? "email.button.open") as never),
    security: input.security,
    ref: input.ref,
    notice: input.notice,
  });
}

