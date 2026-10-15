import { createHmac, timingSafeEqual } from "node:crypto";
import type { OptionalKey } from "./catalog";

/**
 * Signed links in emails (owner, 2026-10-15): Unsubscribe works without logging in, and pictures of designs are shown
 * without making the storage public. Each link carries an HMAC made with the server's secret, so it can't be guessed
 * or changed. Pure (the secret is passed in), so the tests can check it.
 */

const sign = (secret: string, what: string, len = 32) => createHmac("sha256", secret).update(what).digest("base64url").slice(0, len);

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export const unsubscribeSig = (secret: string, userId: string, key: OptionalKey) => sign(secret, `email-unsubscribe:${userId}:${key}`);

export const unsubscribeOk = (secret: string, userId: string, key: OptionalKey, sig: string) => same(unsubscribeSig(secret, userId, key), sig);

/** The query string of an Unsubscribe link: ?u=…&k=…&s=… */
export const unsubscribeQuery = (secret: string, userId: string, key: OptionalKey) => `u=${encodeURIComponent(userId)}&k=${encodeURIComponent(key)}&s=${unsubscribeSig(secret, userId, key)}`;

/** A picture link: which stored file, how wide, until when (seconds), signed. */
export type ImageToken = { bucket: string; path: string; width: number; exp: number };

export function imageToken(secret: string, t: ImageToken): string {
  const body = Buffer.from(JSON.stringify([t.bucket, t.path, t.width, t.exp])).toString("base64url");
  return `${body}.${sign(secret, `email-image:${body}`, 24)}`;
}

/** The picture a token points to, or null when it was changed, is broken or has run out. */
export function readImageToken(secret: string, token: string, now: Date = new Date()): ImageToken | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || !same(sign(secret, `email-image:${body}`, 24), sig)) return null;
  try {
    const [bucket, path, width, exp] = JSON.parse(Buffer.from(body, "base64url").toString()) as [string, string, number, number];
    if (typeof bucket !== "string" || typeof path !== "string" || !Number.isInteger(width) || !Number.isInteger(exp)) return null;
    if (exp * 1000 < now.getTime()) return null;
    return { bucket, path, width, exp };
  } catch {
    return null;
  }
}
