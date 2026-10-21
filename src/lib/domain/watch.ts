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
 * hidden setting system.bd_status, and emails and pushes the admins who manage Settings when it goes down, every 3
 * hours while down, and when it is back. It never flips Backup links by itself. A dry run (anything but the live
 * site) only reports; it writes and sends nothing.
 */

const KEY = "system.bd_status";
const db = () => createAdminClient();

export type WatchRun = { verdict: Verdict; alert: Alert; state: WatchState; detail: string; dryRun: boolean; name: string };

async function readState(now: Date): Promise<WatchState> {
  const { data } = await db().from("settings").select("value").eq("key", KEY).maybeSingle();
  const parsed = SETTINGS[KEY].schema.safeParse(data?.value ?? null);
  return parsed.success && parsed.data ? (parsed.data as WatchState) : FRESH_STATE(now);
}

async function writeState(state: WatchState): Promise<void> {
  const def = SETTINGS[KEY];
  const { error } = await db().from("settings").upsert({ key: KEY, value: state, type: def.type, group: def.group, description: def.description });
  if (error) throw new Error(`settings: ${error.message}`);
}

const dhakaTime = (iso: string, locale: "en" | "bn") =>
  new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Emails (as security mail, so nobody's email settings can block it) and pushes every admin who manages Settings. */
async function sendAlert(alert: Exclude<Alert, null>, state: WatchState, prevSince: string, nx: number): Promise<number> {
  const ids = await adminIdsWith("settings.manage");
  if (!ids.length) return 0;
  const site = backupOrigin() ?? internalProductionOrigin;
  const kind = (state.kind ?? "down_us") as Verdict;
  const { data } = await db().from("profiles").select("id, email, locale").in("id", ids);
  let sent = 0;
  for (const a of data ?? []) {
    const locale = a.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(locale);
    const since = dhakaTime(alert === "back" ? prevSince : state.since, locale);
    const subject = t(alert === "back" ? "admin.domainWatch.subjectBack" : kind === "both_down" ? "admin.domainWatch.subjectBoth" : alert === "reminder" ? "admin.domainWatch.subjectStill" : "admin.domainWatch.subjectDown");
    const main = t(alert === "back" ? "admin.domainWatch.back" : (`admin.domainWatch.${kind}` as MessageKey), { n: formatNumber(nx, locale), backup: site, since });
    const body = `${main}\n\n${t("admin.domainWatch.footer", { since, detail: state.lastDetail ?? "" })}\n\n${site}/admin/settings`;
    await notifyUser(a.id as string, { title: subject, body: main.split("\n")[0], url: `${site}/admin/settings` });
    if (a.email) {
      const r = await emailText({ userId: a.id as string, email: a.email as string, locale, subject, body, security: true, ref: `bd-watch:${alert}:${state.lastAlertAt}` });
      if (r === "sent") sent++;
    }
  }
  return sent;
}

export async function runDomainWatch(opts: { dryRun: boolean; name?: string; now?: Date }): Promise<WatchRun> {
  const now = opts.now ?? new Date();
  const name = opts.name ?? canonicalHost();
  const { signals, serial } = await collectSignals(name, backupOrigin() ? BACKUP_HOST : null);
  const verdict = verdictOf(signals);
  const detail = detailOf(signals, serial);
  const prev = await readState(now);
  const strongNx = signals.us.filter((a) => a === "nxdomain").length >= 3;
  const { state, alert } = nextState(prev, verdict, strongNx, now, detail);
  console.log(`[bd-watch] ${name} verdict=${verdict} state=${state.state} alert=${alert ?? "-"} ${detail}${opts.dryRun ? " (dry run)" : ""}`);
  if (!opts.dryRun) {
    await writeState(state);
    if (alert) await sendAlert(alert, state, prev.since, signals.us.filter((a) => a === "nxdomain").length).catch((e) => console.error("[bd-watch] alert:", e instanceof Error ? e.message : e));
  }
  return { verdict, alert, state, detail, dryRun: opts.dryRun, name };
}
