/**
 * Home hero showcase slides (owner, 2026-10-11; Design/home-hero/HERO-HANDOFF.md). Pure: used by the home page,
 * Admin → Home hero and the tests.
 *
 * Admins make the real slides in Admin → Home hero (table home_hero_slides). While none is switched on, the home
 * page shows the four built-in slides below. They are SAMPLE MATERIAL from the design (logos, names and photos
 * that may not be shown publicly without permission), so they always carry the "Sample artwork" pill.
 */

/** How long each slide shows when the setting can't be read, in milliseconds. */
export const HERO_SLIDE_MS = 2000;

export type HeroImage = { src: string; width: number; height: number };
export type HeroRole = "designer" | "client";
export type HeroItem = "cup" | "ticket" | "bag" | "phone";
export const HERO_ROLES: readonly HeroRole[] = ["designer", "client"];
export const HERO_ITEMS: readonly HeroItem[] = ["cup", "ticket", "bag", "phone"];
export type HeroColors = { main: string; dark: string; light: string; badge: string };
/** Logo widths, as a share of the showcase width (cqw): on the product, on the light card, on the round badge. */
export type LogoSizes = { item: number; card: number; badge: number };

/** One slide as the home page draws it, with its headline and text already in the page's language. */
export type HeroSlideView = {
  key: string;
  /** The brand name as written in the logo (not translated). */
  brand: string;
  /** Who is in the photo: the chip says "Designer · Name" or "Client · Name", the caption follows the role. */
  role: HeroRole;
  /** The person's name (not translated). */
  name: string;
  /** The product drawn next to the photo, in CSS. */
  item: HeroItem;
  colors: HeroColors;
  photo: HeroImage & { position: string };
  /** The colour logo and the white one (for dark or coloured backgrounds). */
  logo: HeroImage;
  logoWhite: HeroImage;
  logoSize: LogoSizes;
  /** The round badge shows the white logo when its background is the brand colour or dark. */
  badgeLogo: "color" | "white";
  copy: { line1: string; line2: string; text: string };
};

/** The widest a logo may be on each product, so it stays inside it. */
const ITEM_MAX: Record<HeroItem, number> = { cup: 10, ticket: 16, bag: 20, phone: 14 };
const clamp = (n: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;

/**
 * Logo sizes for an uploaded logo, from its shape: a wide logo gets more width, a tall one less, so every logo
 * looks about as big (tuned on the four designed slides).
 */
export function logoSizes(width: number, height: number, item: HeroItem): LogoSizes {
  const shape = Math.sqrt(Math.max(0.2, Math.min(5, width / Math.max(1, height))));
  return { item: clamp(12.5 * shape, 6, ITEM_MAX[item]), card: clamp(11.5 * shape, 7, 22), badge: clamp(13.5 * shape, 8, 17) };
}

/** Which part of the photo stays in view: 0 = the top, 100 = the bottom (faces are near the top). */
export const photoPosition = (focus: number) => `50% ${Math.round(Math.min(100, Math.max(0, focus)))}%`;

/** A colour as #RRGGBB, or null. */
export const isHexColor = (v: unknown): v is string => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);

/** Mixes a colour toward white (amount > 0) or black (amount < 0); amount between -1 and 1. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount > 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(amount));
  const ch = (c: number) => Math.round(c + (target - c) * a);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** Suggested slide colours from a logo's main colour: darker for the gradients, very light for the cards and badge. */
export function colorsFrom(main: string): HeroColors {
  const m = isHexColor(main) ? main.toUpperCase() : "#8B0000";
  return { main: m, dark: shade(m, -0.3), light: shade(m, 0.93), badge: shade(m, 0.8) };
}

// ---------------------------------------------------------------------------------------------------------------
// The built-in sample slides (pictures in public/home-hero, texts under home.hero.slides.<id>)
// ---------------------------------------------------------------------------------------------------------------

export type BuiltInSlide = Omit<HeroSlideView, "key" | "copy" | "photo"> & {
  id: "jubilix" | "fly" | "beep" | "favliy";
  photo: HeroImage;
  photoFocus: number;
};

const img = (src: string, width: number, height: number): HeroImage => ({ src: `/home-hero/${src}`, width, height });

export const BUILT_IN_SLIDES: readonly BuiltInSlide[] = [
  {
    id: "jubilix",
    brand: "Jubilix",
    role: "designer",
    name: "MH Sam",
    item: "cup",
    colors: { main: "#553534", dark: "#3A2221", light: "#F6EFE6", badge: "#FFE9B8" },
    photo: img("jubilix-person.jpg", 648, 688),
    photoFocus: 20,
    logo: img("jubilix-logo.png", 334, 480),
    logoWhite: img("jubilix-logo-white.png", 334, 480),
    logoSize: { item: 9, card: 9.5, badge: 11 },
    badgeLogo: "color",
  },
  {
    id: "fly",
    brand: "fly",
    role: "client",
    name: "Sumon",
    item: "ticket",
    colors: { main: "#1B2436", dark: "#0F1626", light: "#F4F5F7", badge: "#FFE1C7" },
    photo: img("fly-person.jpg", 648, 682),
    photoFocus: 30,
    logo: img("fly-logo.png", 409, 420),
    logoWhite: img("fly-logo-white.png", 409, 420),
    logoSize: { item: 13, card: 11, badge: 14 },
    badgeLogo: "color",
  },
  {
    id: "beep",
    brand: "beep",
    role: "client",
    name: "Shabnam",
    item: "bag",
    colors: { main: "#E52D54", dark: "#B81B40", light: "#FFF5F7", badge: "#FFE27A" },
    photo: img("beep-person.jpg", 648, 685),
    photoFocus: 20,
    logo: img("beep-logo.png", 420, 172),
    logoWhite: img("beep-logo-white.png", 420, 172),
    logoSize: { item: 20, card: 22, badge: 17 },
    badgeLogo: "color",
  },
  {
    id: "favliy",
    brand: "Favliy",
    role: "designer",
    name: "Anika",
    item: "phone",
    colors: { main: "#E82C54", dark: "#B21A3E", light: "#FFF5F7", badge: "#E82C54" },
    photo: img("favliy-person.jpg", 648, 648),
    photoFocus: 30,
    logo: img("favliy-logo.png", 420, 380),
    logoWhite: img("favliy-logo-white.png", 420, 380),
    logoSize: { item: 13, card: 12, badge: 14 },
    badgeLogo: "white",
  },
];

/** A built-in picture path (`/home-hero/…`) and its size, or null when it isn't one of them. */
export function builtInImage(path: string): HeroImage | null {
  for (const s of BUILT_IN_SLIDES) for (const i of [s.photo, s.logo, s.logoWhite]) if (i.src === path) return i;
  return null;
}

/** An uploaded picture's path carries its size: hero-slides/<uuid>-<width>x<height>.<jpg|png>. */
export const UPLOADED_IMAGE = /^hero-slides\/[0-9a-f-]{36}-(\d{1,4})x(\d{1,4})\.(jpg|png)$/;

/** The size of a stored slide picture (uploaded or built in), or null when the path isn't a valid one. */
export function imageFromPath(path: string): { width: number; height: number } | null {
  const m = UPLOADED_IMAGE.exec(path);
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  const b = builtInImage(path);
  return b ? { width: b.width, height: b.height } : null;
}
