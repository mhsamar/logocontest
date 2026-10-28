import sharp from "sharp";
import { SITE_BUCKET, SITE_IMAGE_PATH } from "@/lib/content/pictures";
import { getFileStorage } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/**
 * A site picture (home slides, guide and How it works covers, the uploaded logo and icon; owner, 2026-10-28; see
 * lib/content/pictures.ts): fetched from Storage once and kept by the CDN and browsers for a year. Photos become a
 * light WebP; the logo, icon and share picture are sent as they are.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!SITE_IMAGE_PATH.test(path)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await getFileStorage().download(SITE_BUCKET, path);
    const keep = /^(?:logo|icon|share)\//.test(path);
    const body = keep ? bytes : new Uint8Array(await sharp(bytes).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
    const type = keep ? TYPES[path.slice(path.lastIndexOf(".") + 1)] : "image/webp";
    return new Response(Buffer.from(body), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
