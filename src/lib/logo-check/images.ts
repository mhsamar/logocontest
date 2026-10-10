import "server-only";
import sharp from "sharp";
import { isFetchableUrl } from "./rules";

/** Image work for the AI copyright checker (owner, 2026-10-10). */

/** What a client may upload: PNG, JPG or SVG (owner). WebP is accepted too since browsers produce it. */
export const CHECK_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;
/** Upload limit, under the 4.5 MB request limit of the server functions. */
export const CHECK_UPLOAD_MAX = 4 * 1024 * 1024;

/**
 * The logo as it is checked and stored: PNG, at most 1024 px on its longest side. SVGs are drawn into
 * pixels here, so nothing from the file itself (scripts, links) is kept. Null when it isn't a usable image.
 */
export async function normalizeLogo(input: Uint8Array): Promise<Buffer | null> {
  try {
    const img = sharp(input, { density: 300, limitInputPixels: 40_000_000 }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 32 || meta.height < 32) return null;
    return await img.resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    return null;
  }
}

/** A found image made small for comparing (and for our stored copy): PNG, at most 512 px. */
export async function shrinkCandidate(input: Uint8Array): Promise<Buffer | null> {
  try {
    const img = sharp(input, { limitInputPixels: 40_000_000 }).rotate();
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 40 || meta.height < 40) return null;
    return await img.resize(512, 512, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    return null;
  }
}

/** The logo on white, at most 768 px, for the AI (transparent logos would otherwise sit on black). */
export async function logoForAi(png: Uint8Array): Promise<Buffer> {
  return sharp(png).resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).png().toBuffer();
}

const MAX_FETCH = 6 * 1024 * 1024;

/**
 * Reads a found image from the web: https on a public host only, 8 seconds at most, 6 MB at most,
 * and it must say it is an image. `data:image/...;base64,` thumbnails (from Google Lens) are read directly.
 */
export async function fetchImage(url: string, fetcher: typeof fetch = fetch): Promise<Uint8Array | null> {
  const data = /^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/i.exec(url);
  if (data) return data[1].length * 0.75 <= MAX_FETCH ? new Uint8Array(Buffer.from(data[1], "base64")) : null;
  if (!isFetchableUrl(url)) return null;
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(8000), redirect: "follow", headers: { Accept: "image/*" } });
    if (!res.ok || !isFetchableUrl(res.url || url)) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const size = Number(res.headers.get("content-length") ?? 0);
    if (size > MAX_FETCH) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength <= MAX_FETCH ? buf : null;
  } catch {
    return null;
  }
}
