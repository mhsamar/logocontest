import "server-only";
import { adminIdsWith } from "@/lib/admin/recipients";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { notifyUser } from "@/lib/push";
import { SETTINGS } from "@/lib/settings/registry";
import { BACKUP_HOST, backupOrigin, canonicalHost, internalProductionOrigin } from "@/lib/site-hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectSignals } from "./probe";
import { detailOf, FRESH_STATE, nextState, verdictOf, type Alert, type Verdict, type WatchState } from "./rules";

/**
 * The 5-minute .bd watch (owner, 2026-10-21): asks BTCL's servers about logocontest.bd, keeps the state in the
 * hidden setting system.bd_status, and pushes and emails the admins who manage Settings when it goes down, while it
 * stays down and when it is back. It never flips Backup links by itself. A dry run (anything but the live site) only
 * reports; it writes and sends nothing.
 *
 * While .bd is down, email from @logocontest.bd may not arrive (receivers can't check its signature), so the alerts
 * go out from ALERT_EMAIL_FROM (an address on logocontestbd.com, once that domain is verified in Resend) and push
 * goes first.
 */

const KEY = "system.bd_status";
const db = () => createAdminClient();

export type WatchRun = { verdict: Verdict; alert: Alert; delivered: number | null; state: WatchState; detail: string; dryRun: boolean; name: string };

/** A database error stops the run (the next one starts from the saved state); a missing row is a fresh start. */
async function readState(now: Date): Promise<WatchState> {
  const { data, error } = await db().from("settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw new Error(`settings read: ${error.message}`);
  if (!data || data.value == null) return FRESH_STATE(now);
  const parsed = SETTINGS[KEY].schema.safeParse(data.value);
  if (!parsed.success || !parsed.data) {
    console.error("[bd-watch] stored state unreadable; starting fresh");
    return FRESH_STATE(now);
  }
  return parsed.data as WatchState;
}

async function writeState(state: WatchState): Promise<void> {
  const def = SETTINGS[KEY];
  const { error } = await db().from("settings").upsert({ key: KEY, value: state, type: def.type, group: def.group, description: def.description });
  if (error) throw new Error(`settings write: ${error.message}`);
}

const dhakaTime = (iso: string, locale: "en" | "bn") =>
  new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const SUBJECT: Record<Exclude<Alert, null>, MessageKey> = { down: "admin.domainWatch.subjectDown", reminder: "admin.domainWatch.subjectStill", back: "admin.domainWatch.subjectBack" };

/** Pushes first, then emails (as security mail, so nobody's email settings block it). Returns how many arrived. */
async function sendAlert(alert: Exclude<Alert, null>, state: WatchState, prevSince: string, nx: number): Promise<number> {
  const ids = await adminIdsWith("settings.manage");
  if (!ids.length) return 0;
  const site = backupOrigin() ?? internalProductionOrigin;
  const kind = (state.kind ?? "down_us") as Verdict;
  const { data } = await db().from("profiles").select("id, email, locale").in("id", ids);
  const people = await Promise.all(
    (data ?? []).map(async (a) => {
      const locale: "en" | "bn" = a.locale === "bn" ? "bn" : "en";
      const t = await translatorFor(locale);
      const since = dhakaTime(alert === "back" ? prevSince : state.since, locale);
      const subject = t(kind === "both_down" && alert !== "back" ? "admin.domainWatch.subjectBoth" : SUBJECT[alert]);
      const main = t(alert === "back" ? "admin.domainWatch.back" : (`admin.domainWatch.${kind}` as MessageKey), { n: formatNumber(nx, locale), backup: site, since });
      const body = `${main}\n\n${t("admin.domainWatch.footer", { since, detail: state.lastDetail ?? "" })}\n\n${site}/admin/settings`;
      return { id: a.id as string, email: (a.email as string | null) ?? null, locale, subject, main, body };
    }),
  );
  const pushes = await Promise.allSettled(people.map((p) => notifyUser(p.id, { title: p.subject, body: p.main.split("\n")[0], url: `${site}/admin/settings` })));
  const from = process.env.ALERT_EMAIL_FROM?.trim() || undefined;
  const emails = await Promise.allSettled(
    people.filter((p) => p.email).map((p) => emailText({ userId: p.id, email: p.email!, locale: p.locale, subject: p.subject, body: p.body, security: true, ref: `bd-watch:${alert}:${state.since}`, from })),
  );
  const pushed = pushes.reduce((n, r) => n + (r.status === "fulfilled" ? r.value : 0), 0);
  const mailed = emails.filter((r) => r.status === "fulfilled" && r.value === "sent").length;
  if (!pushed) console.error("[bd-watch] no admin got a push: turn on notifications in a browser for the alerts to reach you while .bd is down");
  return pushed + mailed;
}

export async function runDomainWatch(opts: { dryRun: boolean; name?: string; now?: Date }): Promise<WatchRun> {
  const now = opts.now ?? new Date();
  const name = opts.name ?? canonicalHost();
  const prev = await readState(now);
  const { signals, serial } = await collectSignals(name, backupOrigin() ? BACKUP_HOST : null);
  const verdict = verdictOf(signals);
  const detail = detailOf(signals, serial);
  const nx = signals.us.filter((a) => a === "nxdomain").length;
  const { state, alert } = nextState(prev, verdict, nx >= 3, now, detail);
  console.log(`[bd-watch] ${name} verdict=${verdict} state=${state.state} alert=${alert ?? "-"} ${detail}${opts.dryRun ? " (dry run)" : ""}`);
  let delivered: number | null = null;
  if (!opts.dryRun) {
    // Saved before sending, so a run that is cut off never sends the same alert twice.
    await writeState(state);
    if (alert) {
      delivered = await sendAlert(alert, state, prev.since, nx).catch((e) => {
        console.error("[bd-watch] alert:", e instanceof Error ? e.message : e);
        return 0;
      });
      // Nothing arrived: the next run (5 minutes later) tries again as a reminder.
      if (!delivered && alert !== "back") await writeState({ ...state, lastAlertAt: null });
    }
  }
  return { verdict, alert, delivered, state, detail, dryRun: opts.dryRun, name };
}
