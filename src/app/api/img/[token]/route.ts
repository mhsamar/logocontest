import { unstable_cache } from "next/cache";
import sharp from "sharp";
import { requireEnv } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { readViewImageToken, viaSite } from "@/lib/storage/view-links";

export const runtime = "nodejs";

/**
 * A design's picture on the site, or a logo checker picture (owner, 2026-10-27; see lib/storage/view-links.ts): fetched
 * from Storage once, sent as a light WebP of the asked width (a logo keeps its see-through background), and kept by the
 * CDN until the link ends, so repeat views never reach Supabase. Never originals, final files or certificates.
 */
/**
 * The converted picture, kept on the server for 30 days by file and width (owner, 2026-10-28): links change every 12
 * hours, so without this each picture was fetched from Supabase again twice a day per width. Stored names never get
 * new contents, except when previews are rebuilt by script: then change "img-v1".
 */
const converted = unstable_cache(
  async (bucket: string, path: string, width: number) => {
    const bytes = await getFileStorage().download(bucket, path);
    return (await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()).toString("base64");
  },
  ["img-v1"],
  { revalidate: 30 * 86400 },
);

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = readViewImageToken(requireEnv("OTP_SECRET"), token);
  if (!t || !viaSite(t.bucket, t.path)) return new Response("Not found", { status: 404 });
  try {
    const webp = Buffer.from(await converted(t.bucket, t.path, t.width), "base64");
    const life = Math.max(60, t.exp - Math.floor(Date.now() / 1000));
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": `public, max-age=${life}, s-maxage=${life}, immutable` } });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
