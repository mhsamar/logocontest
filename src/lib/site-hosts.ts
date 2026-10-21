import { siteUrl } from "./seo";

/**
 * The site's own addresses (owner, 2026-10-21: BTCL's .bd servers sometimes drop logocontest.bd, so the same site
 * also answers on a backup address that doesn't depend on .bd). Pure functions: safe in tests and next.config.
 *
 * - canonical: logocontest.bd (SITE_URL). Search engines, QR codes, PDFs and certificates always use it.
 * - backup: logocontestbd.com. Only when BACKUP_SITE_URL is set to exactly this address (a typo can't send people
 *   somewhere else).
 * - internal: logocontest.vercel.app. Only for the server calling itself and the background jobs; never shown.
 */

export const BACKUP_HOST = "logocontestbd.com";
export const INTERNAL_HOST = "logocontest.vercel.app";

/** `raw` as a bare https origin on exactly `host` (no user, port, path, query or hash), else null. */
export function strictOrigin(raw: string | undefined | null, host: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash) return null;
    return u.hostname === host ? u.origin : null;
  } catch {
    return null;
  }
}

export const canonicalOrigin = (): string => siteUrl();
export const canonicalHost = (): string => new URL(canonicalOrigin()).hostname;
export const canonicalUrl = (path: string): string => `${canonicalOrigin()}${path.startsWith("/") ? path : `/${path}`}`;

/** Links printed on things kept for years (QR codes, certificates, PDFs): always the main address on the live site. */
export const printedOrigin = (fallback: string): string => (process.env.SITE_URL ? canonicalOrigin() : fallback);

/** The backup address, or null until BACKUP_SITE_URL is set to it in Vercel. */
export function backupOrigin(): string | null {
  const o = strictOrigin(process.env.BACKUP_SITE_URL, BACKUP_HOST);
  return o && o !== canonicalOrigin() ? o : null;
}

export const internalProductionOrigin = `https://${INTERNAL_HOST}`;

/** Every address that is this site, for "is this link ours?" checks. */
export function ownOrigins(): string[] {
  return [canonicalOrigin(), backupOrigin(), internalProductionOrigin].filter((o): o is string => Boolean(o));
}

/** Whether `href` is a link to one of our own addresses (an exact origin match, so logocontest.bd.evil.example is not). */
export function isOwnUrl(href: string, origins: string[] = ownOrigins()): boolean {
  try {
    return origins.includes(new URL(href).origin);
  } catch {
    return false;
  }
}

/**
 * The origin for a request's Host header, when it is one of ours: the main and backup addresses (with or without www),
 * the Vercel address, and any host while developing. Anything else (Vercel previews, made-up hosts) is null.
 */
export function originForHost(rawHost: string | null | undefined, dev = process.env.NODE_ENV !== "production", proto?: string | null): string | null {
  const host = (rawHost ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!host) return null;
  const bare = host.replace(/^www\./, "");
  if (bare === canonicalHost()) return canonicalOrigin();
  const backup = backupOrigin();
  if (backup && bare === BACKUP_HOST) return backup;
  if (host === INTERNAL_HOST) return internalProductionOrigin;
  // While developing, any plain host (localhost, a LAN address, a tunnel) is the address being used.
  if (dev && /^(\[[0-9a-f:]+\]|[a-z0-9.-]+)(:\d+)?$/.test(host)) return `${proto === "https" ? "https" : "http"}://${host}`;
  return null;
}

/** "^logocontest\.bd$": the canonical host as a regex, for the "noindex on every other address" header. */
export function canonicalHostPattern(origin: string = canonicalOrigin()): string {
  const host = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
  return `^${host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
}
