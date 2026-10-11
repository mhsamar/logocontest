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

/** Public URL of a stored picture, or null when none is set. */
export function pictureUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${SITE_BUCKET}/${path}`;
}
