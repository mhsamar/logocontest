/**
 * The .bd watch (owner, 2026-10-21): BTCL's .bd servers sometimes say logocontest.bd doesn't exist although it is
 * Active and paid (2026-10-20), and sometimes every direct .bd name fails at once. Every 5 minutes the job asks
 * BTCL's own servers and two public resolvers, and tells the admins as soon as it is really down, when the kind of
 * trouble changes, and when it is back. Pure rules here.
 */

/** One .bd server's answer: a referral to our name servers, "doesn't exist", or no answer at all. */
export type ServerAnswer = "referral" | "nxdomain" | "unreached";
/** A public resolver's answer (Cloudflare, Google): an address, "doesn't exist", a failure, or nothing usable. */
export type PublicAnswer = "good" | "nxdomain" | "servfail" | "nosignal";

export type Signals = {
  /** Our name at each .bd server. */
  us: ServerAnswer[];
  /** btcl.bd, a name in the same list as ours, at the same servers: tells "only us" from "all of .bd". */
  control: ServerAnswer[];
  /** btcl.com.bd (the separate com.bd list): only shown in the details. */
  controlCom: ServerAnswer[];
  /** Our name at the public resolvers. */
  publicUs: PublicAnswer[];
  /** The backup address at the public resolvers: if it fails too, the problem isn't BTCL. */
  publicBackup: PublicAnswer[];
};

/**
 * ok / ok_public: healthy (ok_public = only the public resolvers could be asked, which may still remember old
 * answers, so it never ends an outage). down_us: only our name is missing; down_all: every direct .bd name is;
 * down_public: BTCL's servers couldn't be asked and the public resolvers say it doesn't exist; validation: BTCL
 * answers but public DNS rejects it (signing); both_down: our backup fails too (Cloudflare or Vercel, not BTCL).
 */
export type Verdict = "ok" | "ok_public" | "down_us" | "down_all" | "down_public" | "validation" | "both_down" | "unknown";
export const DOWN_VERDICTS: Verdict[] = ["down_us", "down_all", "down_public", "validation", "both_down"];

const count = <T>(list: T[], v: T) => list.filter((x) => x === v).length;
const bad = (a: PublicAnswer) => a === "nxdomain" || a === "servfail";

export function verdictOf(s: Signals): Verdict {
  const backupBad = s.publicBackup.length > 0 && s.publicBackup.every(bad);
  const nxUs = count(s.us, "nxdomain");
  if (s.us.filter((a) => a !== "unreached").length >= 2) {
    if (backupBad && s.publicUs.every(bad)) return "both_down";
    // The comparison name only explains an outage of ours; on its own it never means we are down.
    if (nxUs >= 2) return count(s.control, "nxdomain") >= 2 ? "down_all" : "down_us";
    if (count(s.us, "referral") >= 2 && nxUs === 0) {
      if (s.publicUs.length >= 2 && s.publicUs.every((a) => a === "servfail")) return "validation";
      return "ok";
    }
    return "unknown";
  }
  // BTCL's servers couldn't be asked from here: one of them saying "doesn't exist" means we can't tell.
  if (nxUs > 0) return "unknown";
  const badPublic = s.publicUs.filter(bad).length;
  if (badPublic >= 2) return backupBad ? "both_down" : "down_public";
  if (count(s.publicUs, "good") >= 1 && badPublic === 0) return "ok_public";
  return "unknown";
}

export type WatchState = {
  state: "ok" | "down";
  /** The kind of trouble while down. */
  kind: Verdict | null;
  /** When the current state started. */
  since: string;
  downStreak: number;
  okStreak: number;
  lastAlertAt: string | null;
  lastCheck: string | null;
  /** Short codes only (the settings table is public-read): e.g. "us=nx,nx,ref,un ctl=ref… pub=good,good". */
  lastDetail: string | null;
  /** When it last came back: for an hour after, a single bad check doesn't raise a new alarm (BTCL flaps). */
  backAt?: string | null;
  /** The kind of trouble the last message was about (a different kind gets its own message). */
  alertKind?: Verdict | null;
};

export const FRESH_STATE = (now: Date): WatchState => ({ state: "ok", kind: null, since: now.toISOString(), downStreak: 0, okStreak: 0, lastAlertAt: null, lastCheck: null, lastDetail: null, backAt: null, alertKind: null });

export type Alert = "down" | "reminder" | "back" | null;
const MIN = 60_000;
const REMINDER_MS = 180 * MIN;
const KIND_CHANGE_MS = 30 * MIN;
const HOLD_DOWN_MS = 60 * MIN;

/**
 * The next state after one check, and which message to send.
 * - Down: 2 bad checks in a row (10 minutes), or 1 when 3+ .bd servers already say "doesn't exist" (not within an
 *   hour of coming back, so a flapping BTCL doesn't send an alert every few minutes).
 * - While down: a reminder every 3 hours, or after 30 minutes if the kind of trouble changed (the advice differs).
 * - Back: 2 good answers in a row from BTCL's own servers (a public resolver alone may remember the old answer).
 * - "unknown" changes nothing, except that it breaks a run of good checks while down.
 */
export function nextState(prev: WatchState, verdict: Verdict, strongNx: boolean, now: Date, detail: string): { state: WatchState; alert: Alert } {
  const base: WatchState = { ...prev, lastCheck: now.toISOString(), lastDetail: detail };
  const at = now.toISOString();
  const ok = verdict === "ok" || (verdict === "ok_public" && prev.state === "ok");
  const isDown = DOWN_VERDICTS.includes(verdict);
  if (!ok && !isDown) return { state: prev.state === "down" ? { ...base, okStreak: 0 } : base, alert: null };
  if (isDown) {
    const downStreak = prev.downStreak + 1;
    if (prev.state === "ok") {
      const holdDown = prev.backAt ? now.getTime() - new Date(prev.backAt).getTime() < HOLD_DOWN_MS : false;
      if (downStreak >= 2 || (strongNx && !holdDown)) return { state: { ...base, state: "down", kind: verdict, alertKind: verdict, since: at, downStreak, okStreak: 0, lastAlertAt: at }, alert: "down" };
      return { state: { ...base, downStreak, okStreak: 0 }, alert: null };
    }
    const elapsed = prev.lastAlertAt ? now.getTime() - new Date(prev.lastAlertAt).getTime() : Infinity;
    const due = elapsed >= REMINDER_MS || (verdict !== (prev.alertKind ?? prev.kind) && elapsed >= KIND_CHANGE_MS);
    return { state: { ...base, kind: verdict, alertKind: due ? verdict : (prev.alertKind ?? prev.kind), downStreak, okStreak: 0, lastAlertAt: due ? at : prev.lastAlertAt }, alert: due ? "reminder" : null };
  }
  const okStreak = prev.okStreak + 1;
  if (prev.state === "down") {
    if (okStreak >= 2) return { state: { ...base, state: "ok", kind: null, since: at, downStreak: 0, okStreak, lastAlertAt: at, backAt: at }, alert: "back" };
    return { state: { ...base, okStreak, downStreak: 0 }, alert: null };
  }
  return { state: { ...base, okStreak, downStreak: 0 }, alert: null };
}

const SHORT: Record<string, string> = { referral: "ref", nxdomain: "nx", unreached: "un", good: "good", servfail: "fail", nosignal: "-" };
const codes = (list: string[]) => list.map((a) => SHORT[a]).join(",");
export const detailOf = (s: Signals, serial: number | null): string =>
  `us=${codes(s.us)} ctl=${codes(s.control)} com=${codes(s.controlCom)} pub=${codes(s.publicUs)} backup=${codes(s.publicBackup)}${serial ? ` serial=${serial}` : ""}`;
