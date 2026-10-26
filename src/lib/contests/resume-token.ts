import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The "resume contest" link (owner, 2026-10-26): logocontest.bd/r/<token> opens a client's unpaid draft at the step
 * where they stopped, without a password. The token is the contest's id and an end time, signed with the server's
 * secret, so it can't be guessed or changed and stops on its own (security.resume_link_days, 7). It is never the
 * only check: the contest must still be unpaid and its client an active client when it is used. Pure: the secret is
 * passed in.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PART = /^[A-Za-z0-9_-]+$/;
const sign = (secret: string, body: string) => createHmac("sha256", secret).update(`contest-resume:${body}`).digest("base64url").slice(0, 22);

/** "<contest id, 22 letters>.<end time>.<signature>": about 50 letters, short enough for a WhatsApp message. */
export function resumeToken(secret: string, contestId: string, until: Date): string {
  if (!UUID.test(contestId)) throw new Error("Not a contest id");
  const body = `${Buffer.from(contestId.replace(/-/g, ""), "hex").toString("base64url")}.${Math.floor(until.getTime() / 1000).toString(36)}`;
  return `${body}.${sign(secret, body)}`;
}

/** The contest a token opens and until when; null when it is changed, made up or past its end. */
export function readResumeToken(secret: string, token: unknown, now = new Date()): { contestId: string; until: Date } | null {
  if (typeof token !== "string" || token.length > 80) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((p) => PART.test(p))) return null;
  const [id, end, sig] = parts;
  const want = Buffer.from(sign(secret, `${id}.${end}`));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const hex = Buffer.from(id, "base64url").toString("hex");
  if (hex.length !== 32 || !/^[0-9a-z]{1,10}$/.test(end)) return null;
  const until = new Date(parseInt(end, 36) * 1000);
  if (!(until.getTime() > now.getTime())) return null;
  return { contestId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`, until };
}

/** When a link made now stops working. */
export const resumeUntil = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000);
