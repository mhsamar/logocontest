import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Design pictures through the site's own address (owner, 2026-10-27: Supabase's free 5 GB of egress ran out in a
 * month). /api/img/<token> fetches the picture from Storage once, makes it a light WebP of the asked width, and lets
 * Vercel's CDN keep it, so every later view costs Supabase nothing. The token names the file, the width and an end
 * time, signed with the server's secret: nobody can ask for any other file, and it is only made where the page has
 * already decided the viewer may see that design (like the signed links before). Pure: the secret is passed in.
 */

export type ViewImage = { bucket: string; path: string; width: number; exp: number };

/** Links stay the same for 12 hours (so browsers and the CDN keep them) and always work 12 to 24 hours. */
const WINDOW = 12 * 3600;
export const viewExp = (now: Date) => (Math.floor(now.getTime() / 1000 / WINDOW) + 2) * WINDOW;

const sign = (secret: string, body: string) => createHmac("sha256", secret).update(`view-image:${body}`).digest("base64url").slice(0, 24);

export function viewImageToken(secret: string, t: ViewImage): string {
  const body = Buffer.from(JSON.stringify([t.bucket, t.path, t.width, t.exp])).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

/** The picture a token points to, or null when it was changed, is broken or has run out. */
export function readViewImageToken(secret: string, token: unknown, now = new Date()): ViewImage | null {
  if (typeof token !== "string" || token.length > 600) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(sign(secret, body));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const [bucket, path, width, exp] = JSON.parse(Buffer.from(body, "base64url").toString()) as [unknown, unknown, unknown, unknown];
    if (typeof bucket !== "string" || typeof path !== "string" || !Number.isInteger(width) || !Number.isInteger(exp)) return null;
    if ((exp as number) * 1000 <= now.getTime()) return null;
    return { bucket, path, width: width as number, exp: exp as number };
  } catch {
    return null;
  }
}

/** The widths the site asks for: a list thumbnail, a small tile, a grid tile or card cover, a full design. */
export const VIEW_WIDTHS = [240, 480, 640, 1000] as const;

/**
 * Which stored pictures go through the site: design previews (never the original files), and the logo checker's logo
 * and match pictures (never its certificates).
 */
export const viaSite = (bucket: string, path: string) =>
  bucket === "entry-files" ? path.startsWith("previews/") : bucket === "logo-checks" ? /\.(png|jpe?g|webp)$/i.test(path) && !path.includes("certificate") : false;
export const viewWidth = (w: number | undefined) => VIEW_WIDTHS.find((x) => x >= (w ?? 1000)) ?? 1000;

/**
 * A public design's picture at an address that never changes (owner, 2026-11-03: designers' logos in Google Images).
 * The links above change every 12 hours, so search engines could never keep a picture. This one names a design
 * preview and a width, signed, with no end time; the /logo route checks on every load that the design is still public
 * (isShareableDesign), so a design made private, rejected or removed stops showing at once. Only made for designs a
 * logged-out visitor already sees.
 */
const signPublic = (secret: string, body: string) => createHmac("sha256", secret).update(`public-image:${body}`).digest("base64url").slice(0, 22);

export function publicImageToken(secret: string, t: { path: string; width: number }): string {
  const body = Buffer.from(JSON.stringify([t.path, t.width])).toString("base64url");
  return `${body}.${signPublic(secret, body)}`;
}

export function readPublicImageToken(secret: string, token: unknown): { path: string; width: number } | null {
  if (typeof token !== "string" || token.length > 400) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(signPublic(secret, body));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const [path, width] = JSON.parse(Buffer.from(body, "base64url").toString()) as [unknown, unknown];
    if (typeof path !== "string" || !viaSite("entry-files", path) || !(VIEW_WIDTHS as readonly unknown[]).includes(width)) return null;
    return { path, width: width as number };
  } catch {
    return null;
  }
}

/** "MyAdvocate" → "myadvocate-logo"; a name without Latin letters → "logo". For the picture's file name. */
export function logoFileName(brand: string): string {
  const slug = brand.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  return slug ? `${slug}-logo` : "logo";
}

/** The address of a public design picture on this site. */
export const publicImagePath = (secret: string, path: string, width: number, brand: string) => `/logo/${publicImageToken(secret, { path, width })}/${logoFileName(brand)}.webp`;
