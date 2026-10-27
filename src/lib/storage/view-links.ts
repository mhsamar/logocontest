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
