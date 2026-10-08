/** Profile photos live in the public "avatars" bucket (migration 0010). */
export const AVATARS_BUCKET = "avatars";

export const AVATAR_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Public URL of a stored photo, or null when there is none. */
export function avatarUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${AVATARS_BUCKET}/${path}`;
}
