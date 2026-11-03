import { requireEnv } from "@/lib/env";
import { convertedPicture } from "@/lib/storage/converted";
import { readViewImageToken, viaSite } from "@/lib/storage/view-links";

export const runtime = "nodejs";

/**
 * A design's picture on the site, or a logo checker picture (owner, 2026-10-27; see lib/storage/view-links.ts): fetched
 * from Storage once, sent as a light WebP of the asked width (a logo keeps its see-through background), and kept by the
 * CDN until the link ends, so repeat views never reach Supabase. Never originals, final files or certificates.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = readViewImageToken(requireEnv("OTP_SECRET"), token);
  if (!t || !viaSite(t.bucket, t.path)) return new Response("Not found", { status: 404 });
  try {
    const webp = Buffer.from(await convertedPicture(t.bucket, t.path, t.width), "base64");
    const life = Math.max(60, t.exp - Math.floor(Date.now() / 1000));
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": `public, max-age=${life}, s-maxage=${life}, immutable` } });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
