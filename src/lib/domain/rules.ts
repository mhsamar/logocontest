/**
 * The .bd watch (owner, 2026-10-21): BTCL's .bd servers sometimes say logocontest.bd doesn't exist although it is
 * Active and paid (2026-10-20), and sometimes all of .bd fails. Every 5 minutes the job asks BTCL's own servers and
 * two public resolvers, and tells the admins as soon as it is really down and again when it is back. Pure rules here.
 */

/** One .bd server's answer: a referral to our name servers, "doesn't exist", or no answer at all. */
export type ServerAnswer = "referral" | "nxdomain" | "unreached";
/** A public resolver's answer (Cloudflare, Google): an address, "doesn't exist", a failure, or nothing usable. */
export type PublicAnswer = "good" | "nxdomain" | "servfail" | "nosignal";

export type Signals = {
  /** Our name at each .bd server. */
  us: ServerAnswer[];
  /** A well-known .bd name (btcl.com.bd) at the same servers: tells "only us" from "all of .bd". */
  control: ServerAnswer[];
  /** Our name at the public resolvers. */
  publicUs: PublicAnswer[];
  /** The backup address at the public resolvers: if it fails too, the problem isn't BTCL. */
  publicBackup: PublicAnswer[];
};

export type Verdict = "ok" | "down_us" | "down_all" | "validation" | "both_down" | "unknown";
export const DOWN_VERDICTS: Verdict[] = ["down_us", "down_all", "validation", "both_down"];

const count = <T>(list: T[], v: T) => list.filter((x) => x === v).length;
const bad = (a: PublicAnswer) => a === "nxdomain" || a === "servfail";

export function verdictOf(s: Signals): Verdict {
  const backupBad = s.publicBackup.length > 0 && s.publicBackup.every(bad);
  const reachedUs = s.us.filter((a) => a !== "unreached").length;
  if (reachedUs >= 2) {
    const nxUs = count(s.us, "nxdomain");
    const nxControl = count(s.control, "nxdomain");
    // Our own side (Cloudflare or Vercel) failing too is not a BTCL problem.
    if (backupBad && s.publicUs.every(bad)) return "both_down";
    if (nxControl >= 2) return "down_all";
    if (nxUs >= 2) return "down_us";
    if (count(s.us, "referral") >= 2 && nxUs === 0) {
      // BTCL answers fine but both public resolvers fail: a signing (DNSSEC) problem at BTCL.
      if (s.publicUs.length >= 2 && s.publicUs.every((a) => a === "servfail")) return "validation";
      return "ok";
    }
    return "unknown";
  }
  // The .bd servers couldn't be asked from here: go by the public resolvers alone.
  const goodPublic = count(s.publicUs, "good");
  const badPublic = s.publicUs.filter(bad).length;
  if (badPublic >= 2) return backupBad ? "both_down" : "down_us";
  if (goodPublic >= 1 && badPublic === 0) return "ok";
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
};

export const FRESH_STATE = (now: Date): WatchState => ({ state: "ok", kind: null, since: now.toISOString(), downStreak: 0, okStreak: 0, lastAlertAt: null, lastCheck: null, lastDetail: null });

export type Alert = "down" | "reminder" | "back" | null;
const REMINDER_MS = 3 * 3_600_000;

/**
 * The next state after one check, and which message to send. Down needs 2 checks in a row (10 minutes), or 1 when 3
 * or more .bd servers already say "doesn't exist"; back needs 2 good checks in a row (2026-10-20 flapped). "unknown"
 * changes nothing. While down, a reminder every 3 hours.
 */
export function nextState(prev: WatchState, verdict: Verdict, strongNx: boolean, now: Date, detail: string): { state: WatchState; alert: Alert } {
  const base = { ...prev, lastCheck: now.toISOString(), lastDetail: detail };
  if (verdict === "unknown") return { state: base, alert: null };
  if (DOWN_VERDICTS.includes(verdict)) {
    const downStreak = prev.downStreak + 1;
    if (prev.state === "ok") {
      if (downStreak >= 2 || strongNx) return { state: { ...base, state: "down", kind: verdict, since: now.toISOString(), downStreak, okStreak: 0, lastAlertAt: now.toISOString() }, alert: "down" };
      return { state: { ...base, downStreak, okStreak: 0 }, alert: null };
    }
    const due = !prev.lastAlertAt || now.getTime() - new Date(prev.lastAlertAt).getTime() >= REMINDER_MS;
    return { state: { ...base, kind: verdict, downStreak, okStreak: 0, lastAlertAt: due ? now.toISOString() : prev.lastAlertAt }, alert: due ? "reminder" : null };
  }
  // verdict === "ok"
  const okStreak = prev.okStreak + 1;
  if (prev.state === "down") {
    if (okStreak >= 2) return { state: { ...base, state: "ok", kind: null, since: now.toISOString(), downStreak: 0, okStreak, lastAlertAt: now.toISOString() }, alert: "back" };
    return { state: { ...base, okStreak, downStreak: 0 }, alert: null };
  }
  return { state: { ...base, okStreak, downStreak: 0 }, alert: null };
}

const SHORT: Record<string, string> = { referral: "ref", nxdomain: "nx", unreached: "un", good: "good", servfail: "fail", nosignal: "-" };
export const detailOf = (s: Signals, serial: number | null): string =>
  `us=${s.us.map((a) => SHORT[a]).join(",")} ctl=${s.control.map((a) => SHORT[a]).join(",")} pub=${s.publicUs.map((a) => SHORT[a]).join(",")} backup=${s.publicBackup.map((a) => SHORT[a]).join(",")}${serial ? ` serial=${serial}` : ""}`;
