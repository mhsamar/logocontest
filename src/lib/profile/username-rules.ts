import { checkUsernameFormat, suggestUsername, USERNAME_MAX } from "@/lib/designers/signup";

/**
 * Usernames (owner, 2026-10-15; 2026-10-17: name + account number). Every client and designer gets one, made by the
 * site and fixed: the first name and the account's number in its group, e.g. client 10 "Anika Jaman" is anika010 and
 * designer 8 "Das" is das008, so the number shows how many clients or designers have joined. Pure: tested.
 */

/** Titles and short forms that come before the name in Bangladesh: the name after them is used. */
const SKIP = new Set(["md", "mohammad", "mohammed", "muhammad", "muhammed", "mohammod", "mohd", "mst", "mosammat", "mosamat", "most", "mr", "mrs", "ms", "miss", "dr", "engr", "sk", "sheikh", "shaikh"]);
const BASE_MAX = 12;

/** The name part: the first real word of the name in Latin letters ("Md. Asif Khan" → "asif"); else "client"/"designer". */
export function usernameBase(name: string, role: "client" | "designer"): string {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => w.replace(/\d+$/, ""))
    .filter((w) => /^[a-z]/.test(w) && w.length >= 2);
  const pick = words.find((w) => !SKIP.has(w)) ?? words[0] ?? "";
  return pick.slice(0, BASE_MAX) || role;
}

/** The username for a name and an account number: three digits at least ("anika" + 10 → "anika010"). */
export const memberUsername = (base: string, n: number): string => `${base}${String(Math.max(1, Math.floor(n))).padStart(3, "0")}`;

/** The username if the plain one is taken (for example a client and a designer with the same name and number). */
export const memberUsernameAlt = (base: string, n: number, role: "client" | "designer"): string => `${memberUsername(base, n)}_${role[0]}`;

/**
 * Before migration 0065 there are no account numbers: usernames to try from the person's name, best first:
 * "anika_jaman", then "anika_jaman2"… A name with no Latin letters starts from "client"/"designer" plus a number.
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
