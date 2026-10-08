/**
 * Rebuilds every design preview from its original upload, without a watermark
 * (owner, 2026-10-08: logos stay clean). Originals are untouched; previews are overwritten.
 *
 *   npx tsx scripts/rebuild-previews.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { SETTINGS } from "../src/lib/settings/registry";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "entry-files";

async function main() {
  const { data: setting } = await db.from("settings").select("value").eq("key", "limits.entry_preview_max_px").maybeSingle();
  const maxPx = Number(setting?.value ?? SETTINGS["limits.entry_preview_max_px"].default);

  const { data: rows, error } = await db.from("entry_images").select("original_path, preview_path");
  if (error) throw new Error(error.message);
  let done = 0;
  for (const row of rows ?? []) {
    const { data: file, error: dl } = await db.storage.from(BUCKET).download(row.original_path as string);
    if (dl || !file) {
      console.warn(`skip ${row.preview_path}: ${dl?.message ?? "missing original"}`);
      continue;
    }
    const preview = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    const { error: up } = await db.storage.from(BUCKET).upload(row.preview_path as string, preview, { contentType: "image/jpeg", upsert: true });
    if (up) console.warn(`failed ${row.preview_path}: ${up.message}`);
    else done++;
  }
  console.log(`✓ rebuilt ${done} of ${rows?.length ?? 0} previews without a watermark`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
