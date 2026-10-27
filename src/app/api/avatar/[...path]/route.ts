import sharp from "sharp";
import { AVATAR_PATH, AVATARS_BUCKET } from "@/lib/profile/avatar";
import { getFileStorage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * A profile photo on the site (owner, 2026-10-27; see lib/profile/avatar.ts): the public photo as a 256 px WebP, kept by
 * the CDN for a day and by browsers for a week. A new photo has a new name, so nobody sees an old one by mistake.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  if (!AVATAR_PATH.test(path)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await getFileStorage().download(AVATARS_BUCKET, path);
    const webp = await sharp(bytes).rotate().resize({ width: 256, height: 256, fit: "cover", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=604800, s-maxage=86400" } });
  } catch {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
