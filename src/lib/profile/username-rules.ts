import { checkUsernameFormat, suggestUsername, USERNAME_MAX } from "@/lib/designers/signup";

/**
 * Usernames (owner, 2026-10-15): every client and designer has one, made once and fixed. Clients get one from their
 * name; designers pick theirs at sign-up. Only Pro designers can change it, once every 60 days. Pure: tested.
 */

export const USERNAME_CHANGE_DAYS = 60;
const DAY = 86_400_000;

/** When a Pro designer may change their username again: now if never changed, else 60 days after the last change. */
export function nextUsernameChange(lastChangedAt: Date | null): Date | null {
  return lastChangedAt ? new Date(lastChangedAt.getTime() + USERNAME_CHANGE_DAYS * DAY) : null;
}

export function canChangeUsername(lastChangedAt: Date | null, now: Date): boolean {
  const next = nextUsernameChange(lastChangedAt);
  return !next || now >= next;
}

/**
 * Usernames to try for a person, best first: "anika_jaman", then "anika_jaman2", "anika_jaman3"… A name with no Latin
 * letters (e.g. Bangla only) or a reserved word starts from "client"/"designer" plus a number.
 */
export function usernameCandidates(name: string, role: "client" | "designer", random: () => number = Math.random): string[] {
  const fromName = suggestUsername(name);
  const base = fromName && checkUsernameFormat(fromName).ok ? fromName : "";
  const out: string[] = [];
  if (base) {
    out.push(base);
    for (let n = 2; n <= 9; n++) out.push(`${base.slice(0, USERNAME_MAX - 1)}${n}`);
    for (let i = 0; i < 6; i++) out.push(`${base.slice(0, USERNAME_MAX - 4)}${100 + Math.floor(random() * 900)}`);
  }
  for (let i = 0; i < 10; i++) out.push(`${role}_${1000 + Math.floor(random() * 9000)}`);
  return [...new Set(out)].filter((u) => checkUsernameFormat(u).ok);
}
