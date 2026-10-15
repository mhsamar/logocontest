import sharp from "sharp";
import { requireEnv } from "@/lib/env";
import { readImageToken } from "@/lib/email/links";
import { getFileStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Only design previews are ever shown in emails (never other people's logos from checker results).
const BUCKETS = new Set(["entry-files"]);

/**
 * A design's picture in an email (owner, 2026-10-15): the link in the email is signed (see lib/email/links.ts), so
 * nobody can ask for any other file. Sent as a JPEG at most 1200 pixels wide, which every email app shows.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = readImageToken(requireEnv("OTP_SECRET"), token);
  if (!t || !BUCKETS.has(t.bucket) || !t.path.startsWith("previews/")) return new Response("Not found", { status: 404 });
  try {
    const bytes = await getFileStorage().download(t.bucket, t.path);
    const jpeg = await sharp(bytes).rotate().resize({ width: Math.min(1200, Math.max(64, t.width)), withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=2592000, immutable" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
