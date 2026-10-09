/**
 * Storage backup (BLUEPRINT §18.4): downloads every file in every Supabase storage bucket
 * into backups/files-<date>/<bucket>/<path>. Files already downloaded are skipped.
 *
 *   npm run backup:files
 *
 * The files include designers' originals and final files: keep the folder private and never commit it.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = new Date().toISOString().slice(0, 10);
const root = path.join("backups", `files-${stamp}`);

/** Every file path under a folder (folders come back without an id). */
async function listAll(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(bucket, full)));
      else out.push(full);
    }
    if (data.length < 1000) return out;
  }
}

const exists = (p) => access(p).then(() => true, () => false);

const { data: buckets, error } = await db.storage.listBuckets();
if (error) throw error;
let saved = 0;
let skipped = 0;
for (const b of buckets) {
  const files = await listAll(b.id);
  console.log(`${b.id}: ${files.length} files`);
  for (const file of files) {
    const dest = path.join(root, b.id, file);
    if (await exists(dest)) {
      skipped++;
      continue;
    }
    const { data, error: e } = await db.storage.from(b.id).download(file);
    if (e) {
      console.error(`  failed ${file}: ${e.message}`);
      continue;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.from(await data.arrayBuffer()));
    saved++;
  }
}
console.log(`Done: ${saved} saved, ${skipped} already there, in ${root}`);
