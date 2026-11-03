import "server-only";
import { unstable_cache } from "next/cache";
import sharp from "sharp";
import { getFileStorage } from "@/lib/storage";

/**
 * The converted picture, kept on the server for 30 days by file and width (owner, 2026-10-28): links change every 12
 * hours, so without this each picture was fetched from Supabase again twice a day per width. Stored names never get
 * new contents, except when previews are rebuilt by script: then change "img-v1". Used by /api/img and /logo.
 */
export const convertedPicture = unstable_cache(
  async (bucket: string, path: string, width: number) => {
    const bytes = await getFileStorage().download(bucket, path);
    return (await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()).toString("base64");
  },
  ["img-v1"],
  { revalidate: 30 * 86400 },
);
