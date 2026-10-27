/** Profile photos live in the public "avatars" bucket (migration 0010). */
export const AVATARS_BUCKET = "avatars";

export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A stored photo's name: "<user id>/<uuid>.<jpg|png|webp>" (checked on save, profile/actions.ts). */
export const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * A stored photo's link, or null when there is none. On the site (owner, 2026-10-27: photos are 512 px but shown at
 * 30–96 px): /api/avatar, a 256 px WebP the CDN keeps, so Supabase sends each photo about once a day. `full`: the
 * stored photo itself, for the cards drawn on the server (win, monthly and payout cards).
 */
export function avatarUrl(path: string | null | undefined, opts?: { full?: boolean }): string | null {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !supabase) return null;
  if (opts?.full || !AVATAR_PATH.test(path)) return `${supabase.replace(/\/$/, "")}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`;
  return `${(process.env.SITE_URL ?? "").replace(/\/$/, "")}/api/avatar/${path}`;
}
