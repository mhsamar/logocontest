import "server-only";
import sharp from "sharp";

/**
 * Pictures for Admin → Home hero (owner, 2026-10-11). The server re-saves every upload so the home page gets
 * small, clean files: photos as JPEG (longest side 1000 px, no hidden data such as where a phone photo was taken),
 * logos as PNG with the empty see-through edges cut off (longest side 800 px). The white logo can be made from
 * the colour one.
 */

export class HeroImageError extends Error {
  constructor(readonly reason: "unreadable" | "tooSmall" | "notTransparent") {
    super(reason);
  }
}

type Out = { bytes: Uint8Array; width: number; height: number };
const LIMIT = { limitInputPixels: 60_000_000 };

async function readable(bytes: Uint8Array) {
  try {
    const meta = await sharp(bytes, LIMIT).metadata();
    if (!meta.width || !meta.height) throw new Error("no size");
    return meta;
  } catch {
    throw new HeroImageError("unreadable");
  }
}

/** The person photo: at least 400×400, saved as JPEG. */
export async function processPhoto(input: Uint8Array): Promise<Out> {
  await readable(input);
  const rotated = sharp(input, LIMIT).rotate();
  const { info: probe } = await rotated.clone().toBuffer({ resolveWithObject: true });
  if (probe.width < 400 || probe.height < 400) throw new HeroImageError("tooSmall");
  const { data, info } = await rotated
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  return { bytes: new Uint8Array(data), width: info.width, height: info.height };
}

/** A logo: must have a see-through background (it sits on coloured products); the empty edges are cut off. */
export async function processLogo(input: Uint8Array): Promise<Out> {
  await readable(input);
  const stats = await sharp(input, LIMIT).ensureAlpha().stats();
  if (stats.isOpaque) throw new HeroImageError("notTransparent");
  let trimmed: Buffer;
  try {
    trimmed = await sharp(input, LIMIT).ensureAlpha().trim().png().toBuffer();
  } catch {
    // trim() fails on a logo that is all one colour; keep it as it is.
    trimmed = await sharp(input, LIMIT).ensureAlpha().png().toBuffer();
  }
  const { data, info } = await sharp(trimmed).resize(800, 800, { fit: "inside", withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  if (info.width < 60 && info.height < 60) throw new HeroImageError("tooSmall");
  return { bytes: new Uint8Array(data), width: info.width, height: info.height };
}

/** The white version of a processed logo: every visible pixel white, the see-through parts kept. */
export async function whiteLogo(logo: Out): Promise<Out> {
  const alpha = await sharp(logo.bytes).ensureAlpha().extractChannel(3).png().toBuffer();
  const data = await sharp({ create: { width: logo.width, height: logo.height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .joinChannel(alpha)
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { bytes: new Uint8Array(data), width: logo.width, height: logo.height };
}

/**
 * The logo's main colour, to suggest the slide's colours: the most common clearly visible colour, leaving out
 * near-white and near-grey pixels. Null for a logo that is only black, white or grey.
 */
export async function mainColor(logo: Out): Promise<string | null> {
  const { data, info } = await sharp(logo.bytes).ensureAlpha().resize(120, 120, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min > 235 || max - min < 18) continue; // white or grey
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const c = counts.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    c.n += 1;
    c.r += r;
    c.g += g;
    c.b += b;
    counts.set(key, c);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const c of counts.values()) if (!best || c.n > best.n) best = c;
  if (!best || best.n < 8) return null;
  const hex = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, "0");
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
}
