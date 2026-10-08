import "server-only";
import sharp from "sharp";

/** Server-side work on design mockups (BLUEPRINT §9.2, owner 2026-10-08). */

export const ENTRY_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Width and height of a stored image, or null when it can't be read as an image. */
export async function imageSize(input: Uint8Array): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(input).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}

/** The preview every viewer sees: JPEG, at most `maxPx` square, no watermark (owner, 2026-10-08: logos stay clean). */
export async function previewImage(input: Uint8Array, maxPx: number): Promise<Buffer> {
  return sharp(input).rotate().resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

/** 64-bit difference hash as 16 hex characters: similar images give similar hashes. */
export async function differenceHash(input: Uint8Array): Promise<string> {
  const { data } = await sharp(input).rotate().grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) bits += data[row * 9 + col] > data[row * 9 + col + 1] ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** How many bits differ between two hashes. 0 = same picture; up to ~6 = near-duplicate. */
export function hammingDistance(a: string, b: string): number {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      n += x & 1;
      x >>= 1;
    }
  }
  return n;
}

export const NEAR_DUPLICATE_DISTANCE = 6;
