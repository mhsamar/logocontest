import "server-only";
import { isSupabaseConfigured, requireEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { designerEmailsOff, noticeOn } from "@/lib/notifications/switches";
import { isPro } from "@/lib/pro/status";
import { linkOrigin } from "@/lib/site-origin";
import { getEmailSender } from "./index";
import { isDesignerEmail, isOptionalKey, parseEmailOff, shouldSend, tierAllows, type EmailKey } from "./catalog";
import { unsubscribeQuery } from "./links";
import { render, type EmailData } from "./render";
import { EmailSendError } from "./types";

/**
 * Sending one designed email (owner, 2026-10-15). In order: the person's Email settings (codes and security emails
 * always go), the daily limit (Settings › Emails), the shared parts (logo, links, Unsubscribe), then Resend with up
 * to 3 retries, and a row in email_log either way. Never throws: it says "sent", "failed" or "skipped".
 */

export type SendStatus = "sent" | "failed" | "skipped";

/** A user (by id; `email` sends to a new address instead, like a code for a changed email), or an address with no account. */
export type EmailTo = { userId?: string | null; email?: string; name?: string | null };

export type SendInput = {
  key: EmailKey;
  to: EmailTo;
  data: EmailData;
  /** What it is about (a contest, a chat), for limits like one chat email per 30 minutes. */
  ref?: string;
  /** Password reset, account suspended…: always sent, no Unsubscribe. */
  security?: boolean;
  /** Its row in Admin › Notifications, where the owner can turn its email off (owner, 2026-10-15). */
  notice?: string;
  /** Another sender than EMAIL_FROM (owner, 2026-10-21: the .bd watch's alerts). */
  from?: string;
};

/** The Admin › Notifications row of emails that belong to one row only. */
const NOTICE_OF: Partial<Record<EmailKey, string>> = {
  welcome: "welcome",
  "contest-invite": "pro_invited",
  "contest-ending": "contest_ending",
  "entry-shortlisted": "entry_shortlisted",
  "contest-won": "winner_picked",
  "client-new-entries": "entry_new",
  "client-pick-winner": "judging_started",
  "logo-check-ready": "logo_check_ready",
  "pro-receipt": "pro_activated",
  "pro-renewal": "pro_renew",
};

const REPLY_TO = process.env.EMAIL_REPLY_TO || "support@logocontest.bd";
const RETRY_DELAYS = [500, 1500, 3000];
const DAY = 86_400_000;
const DHAKA = 6 * 3_600_000;

/**
 * Links in emails point at the live site: logocontest.bd, or logocontestbd.com while Admin › Settings › Backup links
 * is on (owner, 2026-10-21). Without SITE_URL (local development) the address being used.
 */
export async function emailOrigin(): Promise<string> {
  try {
    return await linkOrigin();
  } catch {
    return siteUrl();
  }
}

/** Midnight in Dhaka today: the daily limit starts again then. */
export const dhakaDayStart = (now: Date) => new Date(Math.floor((now.getTime() + DHAKA) / DAY) * DAY - DHAKA);

type Person = { id: string | null; email: string; name: string; off: string[]; gone: boolean; role: string | null };

async function person(to: EmailTo): Promise<Person | null> {
  if (!to.userId || !isSupabaseConfigured()) return to.email ? { id: to.userId ?? null, email: to.email, name: (to.name ?? "").trim(), off: [], gone: false, role: null } : null;
  const db = createAdminClient();
  const cols = "id, email, name, role, status, deleted_at";
  // email_off comes with migration 0057; before it, nobody has turned anything off.
  let { data, error } = await db.from("profiles").select(`${cols}, email_off`).eq("id", to.userId).maybeSingle();
  if (error) ({ data, error } = await db.from("profiles").select(cols).eq("id", to.userId).maybeSingle());
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return { id: row.id as string, email: to.email ?? ((row.email as string | null) ?? ""), name: ((to.name ?? (row.name as string | null)) ?? "").trim(), off: parseEmailOff(row.email_off), gone: Boolean(row.deleted_at), role: (row.role as string | null) ?? null };
}

async function log(row: { user_id: string | null; template: EmailKey; ref: string | null; security: boolean; status: SendStatus; reason?: string | null; provider_id?: string | null; attempts?: number }) {
  const { error } = await createAdminClient().from("email_log").insert({ reason: null, provider_id: null, attempts: 0, ...row });
  if (error) console.error("[email] log:", error.message);
}

/** Emails (not codes or security emails) sent today, for the daily limit. */
async function sentToday(now: Date): Promise<number> {
  const { count } = await createAdminClient()
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .eq("security", false)
    .neq("template", "otp")
    .gte("created_at", dhakaDayStart(now).toISOString());
  return count ?? 0;
}

/** When this person was last sent this email about this thing (for "at most once per …"). */
export async function lastSent(userId: string, key: EmailKey, ref: string): Promise<Date | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("email_log").select("created_at").eq("user_id", userId).eq("template", key).eq("ref", ref).eq("status", "sent").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? new Date(data.created_at as string) : null;
}

const firstName = (name: string) => name.split(/\s+/)[0] ?? "";

/** The address and settings link block every email shares. */
async function shared(origin: string): Promise<EmailData> {
  const s = await getSettings(["contact.address_en"]).catch(() => ({ "contact.address_en": "" }));
  return {
    site_url: origin,
    logo_url: `${origin}/brand/logo-icon-tile.png`,
    settings_url: `${origin}/help`,
    help_url: `${origin}/help`,
    company_address: s["contact.address_en"]?.trim() || "Dhaka, Bangladesh",
  };
}

export async function sendEmail(input: SendInput): Promise<SendStatus> {
  const { key, ref = null } = input;
  const security = key === "otp" || Boolean(input.security);
  let userId: string | null = null;
  try {
    const p = await person(input.to);
    if (!p) return "skipped";
    userId = p.id;
    const skip = async (reason: string) => {
      if (isSupabaseConfigured()) await log({ user_id: userId, template: key, ref, security, status: "skipped", reason });
      return "skipped" as const;
    };
    if (!p.email) return skip("no_email");
    if (p.gone && !security) return skip("deleted");
    if (!shouldSend(key, p.off, security)) return skip("off");
    // Designer emails by plan (owner, 2026-10-15): Admin › Notifications sets which go to Basic and to Pro designers.
    if (!security && p.role === "designer" && p.id && isDesignerEmail(key)) {
      const tiers = await designerEmailsOff();
      if (tiers.basic.length || tiers.pro.length) {
        const tier = (await isPro(p.id)) ? "pro" : "basic";
        if (!tierAllows(tiers, tier, key)) return skip(`${tier}_off`);
      }
    }
    if (!security && !(await noticeOn(input.notice ?? NOTICE_OF[key], "email"))) return skip("admin_off");
    if (!security && isSupabaseConfigured()) {
      const limit = (await getSettings(["email.daily_limit"]))["email.daily_limit"];
      if (limit > 0 && (await sentToday(new Date())) >= limit) return skip("limit");
    }

    const origin = await emailOrigin();
    const unsub = !security && p.id && isOptionalKey(key) ? unsubscribeQuery(requireEnv("OTP_SECRET"), p.id, key) : null;
    const data: EmailData = {
      ...(await shared(origin)),
      email: p.email,
      first_name: firstName(p.name),
      unsubscribe_url: unsub ? `${origin}/email/unsubscribe?${unsub}` : "",
      // "Email settings" in the footer (owner, 2026-10-15): people have no settings page now; it opens this email's
      // own page to stop it (or start it again), and Help for emails that can't be stopped.
      ...(unsub ? { settings_url: `${origin}/email/unsubscribe?${unsub}` } : {}),
      ...input.data,
    };
    const mail = render(key, data);
    const headers: Record<string, string> = unsub ? { "List-Unsubscribe": `<${origin}/api/email/unsubscribe?${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : {};

    const sender = getEmailSender();
    let attempts = 0;
    let lastError = "";
    for (;;) {
      attempts++;
      try {
        const receipt = await sender.send({ to: p.email, subject: mail.subject, text: mail.text, html: mail.html, replyTo: REPLY_TO, headers, from: input.from });
        if (isSupabaseConfigured()) await log({ user_id: userId, template: key, ref, security, status: "sent", provider_id: receipt.id, attempts });
        return "sent";
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        const again = !(e instanceof EmailSendError) || e.retry;
        if (!again || attempts > RETRY_DELAYS.length) break;
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempts - 1]));
      }
    }
    console.error(`[email] ${key} failed after ${attempts} tries:`, lastError);
    if (isSupabaseConfigured()) await log({ user_id: userId, template: key, ref, security, status: "failed", reason: lastError.slice(0, 300), attempts });
    return "failed";
  } catch (e) {
    console.error(`[email] ${key}:`, e instanceof Error ? e.message : e);
    if (isSupabaseConfigured()) await log({ user_id: userId, template: key, ref, security, status: "failed", reason: (e instanceof Error ? e.message : String(e)).slice(0, 300) }).catch(() => undefined);
    return "failed";
  }
}
