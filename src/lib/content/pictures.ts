/** Site pictures (BLUEPRINT §13.1, A-17): stored in the public "site" bucket (migration 0028). */

export const SITE_BUCKET = "site";
export const PICTURE_KINDS = ["logo", "icon", "hero", "share", "how_client", "how_designer"] as const;
export type PictureKind = (typeof PICTURE_KINDS)[number];
/** The pictures on Brand & notice (A-17); the How it works video covers are in Admin → Homepage. */
export const BRAND_PICTURES = ["logo", "icon", "hero", "share"] as const satisfies readonly PictureKind[];

/** The setting that holds each picture's file path. */
export const PICTURE_SETTING = {
  logo: "brand.logo",
  icon: "brand.icon",
  hero: "brand.hero",
  share: "brand.share",
  how_client: "how.cover_client",
  how_designer: "how.cover_designer",
} as const satisfies Record<PictureKind, string>;
export const isPictureKind = (v: string): v is PictureKind => (PICTURE_KINDS as readonly string[]).includes(v);

export const PICTURE_MAX_BYTES = 2 * 1024 * 1024;

const PNG = { "image/png": "png" };
const JPG = { "image/jpeg": "jpg" };
const WEBP = { "image/webp": "webp" };

/** Allowed file types for each picture, as MIME type → file extension. */
export const PICTURE_TYPES: Record<PictureKind, Record<string, string>> = {
  logo: { ...PNG, ...JPG, ...WEBP, "image/svg+xml": "svg" },
  icon: PNG,
  hero: { ...PNG, ...JPG, ...WEBP },
  share: { ...PNG, ...JPG },
  how_client: { ...PNG, ...JPG, ...WEBP },
  how_designer: { ...PNG, ...JPG, ...WEBP },
};

/** The stored path of a freshly uploaded picture must look exactly like this. */
export const picturePathPattern = (kind: PictureKind) => new RegExp(`^${kind}/[0-9a-f-]{36}\\.(${[...new Set(Object.values(PICTURE_TYPES[kind]))].join("|")})$`);

/** Public URL of a stored picture, or null when none is set. For other sites (share cards, structured data). */
export function pictureUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${SITE_BUCKET}/${path}`;
}

/**
 * Site pictures the site serves itself (owner, 2026-10-28: the home slides alone cost Supabase about 1 GB a month).
 * /api/site-img fetches the file once and the CDN keeps it for a year: every uploaded name holds a fresh UUID, so a
 * name never shows a different picture. SVG logos stay on Supabase, never on the site's own address.
 */
export const SITE_IMAGE_PATH =
  /^(?:(?:logo|icon|hero|share|how_client|how_designer)\/[0-9a-f-]{36}\.(?:png|jpg|webp)|hero-slides\/[0-9a-f-]{36}-\d{1,4}x\d{1,4}\.(?:jpg|png)|guides\/[0-9a-f-]{36}\.(?:png|jpg|webp))$/;

/** Where a page shows a site picture: through /api/site-img, or its public Storage URL for anything else. */
export function siteImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return SITE_IMAGE_PATH.test(path) ? `/api/site-img/${path}` : pictureUrl(path);
}

/** A picture written into a guide's text (its public Storage URL), shown through the site instead. */
export function siteImageFromUrl(url: string): string {
  const base = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/public/${SITE_BUCKET}/`;
  const path = url.startsWith(base) ? url.slice(base.length) : "";
  return SITE_IMAGE_PATH.test(path) ? `/api/site-img/${path}` : url;
}
