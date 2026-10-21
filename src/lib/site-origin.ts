import "server-only";
import { headers } from "next/headers";
import { getSetting } from "@/lib/settings";
import { backupOrigin, canonicalOrigin, internalProductionOrigin, originForHost } from "./site-hosts";

/**
 * Which of the site's addresses to use, on the server (owner, 2026-10-21). See site-hosts.ts for the addresses.
 * - requestOrigin(): the address this visitor is on (only our own; anything else counts as the main address).
 * - linkOrigin(): for links handed out for later (emails, notifications, Facebook cards, share buttons): the main
 *   address, or the backup while Admin › Settings › "Backup links" is on during a .bd problem.
 * - internalOrigin(): for the server calling itself, which must work while .bd is down.
 */

async function hostHeader(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-host") ?? h.get("host");
  } catch {
    return null;
  }
}

export async function requestOrigin(): Promise<string> {
  return originForHost(await hostHeader()) ?? canonicalOrigin();
}

// The switch is read at most every 30 seconds per server (route handlers and background work don't share React's
// per-request cache).
let memo: { at: number; on: boolean } | null = null;

/** Whether new links go to the backup address right now. Never on while the backup isn't set up. */
export async function backupLinksOn(): Promise<boolean> {
  if (!backupOrigin()) return false;
  if (memo && Date.now() - memo.at < 30_000) return memo.on;
  try {
    const on = (await getSetting("site.backup_links")) === true;
    memo = { at: Date.now(), on };
    return on;
  } catch {
    return false;
  }
}

/** Forget the remembered switch (right after an admin changes it, on that server). */
export function forgetBackupLinks(): void {
  memo = null;
}

export async function linkOrigin(): Promise<string> {
  const backup = backupOrigin();
  if (backup && (await backupLinksOn())) return backup;
  // Without SITE_URL (local development) links point at the address being used.
  if (!process.env.SITE_URL) return requestOrigin();
  return canonicalOrigin();
}

export async function internalOrigin(): Promise<string> {
  if (process.env.VERCEL_ENV === "production") return internalProductionOrigin;
  if (!process.env.SITE_URL) return requestOrigin();
  return canonicalOrigin();
}
