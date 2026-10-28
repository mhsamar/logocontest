import "server-only";
import sharp from "sharp";

/**
 * Lighter designer cards (owner, 2026-10-27: "image er quality valo rakhay size always compresed korba"). Chrome draws
 * a win, monthly or payment card as a PNG of about 1 MB; it is kept and downloaded as a good JPEG instead, and pages
 * show a small WebP copy (/api/cards/...?w=640) that Vercel's CDN keeps, so showing a card costs Supabase nothing.
 */
export const cardJpeg = async (png: Uint8Array) => new Uint8Array(await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer());

/** The widths pages ask for: a square card (shown up to 520 px wide) and a tall story card (shown narrow). */
export const CARD_VIEW_WIDTHS = [320, 640] as const;
export const cardViewWidth = (w: string | null) => CARD_VIEW_WIDTHS.find((x) => String(x) === w) ?? null;
export const cardWebp = async (picture: Uint8Array, width: number) =>
  new Uint8Array(await sharp(picture).resize({ width, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toBuffer());

/** The small copy's link: square cards at 640, story cards at 320. */
export const cardThumb = (route: string, size: "square" | "story") => `${route}?w=${size === "square" ? 640 : 320}`;
