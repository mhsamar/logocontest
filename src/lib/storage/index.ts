import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * File storage behind an interface (BLUEPRINT §4). The browser uploads straight
 * to a one-time signed URL, so files never pass through our server.
 */
export interface FileStorage {
  createUploadUrl(bucket: string, path: string): Promise<{ path: string; token: string }>;
  exists(bucket: string, path: string): Promise<boolean>;
  /** The stored file's real size and type, or null if it isn't there (owner, 2026-10-22: never trust what the browser says). */
  stat(bucket: string, path: string): Promise<{ size: number; mimetype: string } | null>;
  remove(bucket: string, paths: string[]): Promise<void>;
  /** Reads a stored file (for server-side checks such as image moderation). */
  download(bucket: string, path: string): Promise<Uint8Array>;
  /** Writes a file from the server (overwrites). */
  upload(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Short-lived links to read private files. Missing files are left out. */
  createReadUrls(bucket: string, paths: string[], seconds: number): Promise<Map<string, string>>;
}

/**
 * Signed links to pictures shown again and again (owner, 2026-10-27: Storage egress). A fresh link on every page render
 * made the browser download every design again each time a design was opened or closed, rated or commented on. A
 * link is now kept on this server and handed out again while it still lasts at least as long as the caller asked, so
 * the browser and Supabase's CDN serve the repeats. Only for these buckets: never payment proofs, ID photos, claim or
 * handover files, which keep a fresh short link every time.
 */
const KEEP_BUCKETS = new Set(["entry-files", "contest-files", "pro-files", "logo-checks"]);
const KEEP_MAX = 5000;
const kept = new Map<string, { url: Promise<string | null>; until: number }>();

function room(now: number, adding: number) {
  if (kept.size + adding <= KEEP_MAX) return;
  for (const [k, v] of kept) if (v.until <= now) kept.delete(k);
  if (kept.size + adding > KEEP_MAX) kept.clear();
}

class SupabaseFileStorage implements FileStorage {
  private get db() {
    return createAdminClient();
  }

  async createUploadUrl(bucket: string, path: string) {
    const { data, error } = await this.db.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "Could not create upload URL");
    return { path: data.path, token: data.token };
  }

  async exists(bucket: string, path: string) {
    const folder = path.split("/").slice(0, -1).join("/");
    const name = path.split("/").pop()!;
    const { data, error } = await this.db.storage.from(bucket).list(folder, { search: name, limit: 1 });
    if (error) throw new Error(error.message);
    return (data ?? []).some((f) => f.name === name);
  }

  async stat(bucket: string, path: string) {
    const folder = path.split("/").slice(0, -1).join("/");
    const name = path.split("/").pop()!;
    const { data, error } = await this.db.storage.from(bucket).list(folder, { search: name, limit: 1 });
    if (error) throw new Error(error.message);
    const file = (data ?? []).find((f) => f.name === name);
    if (!file) return null;
    const meta = (file.metadata ?? {}) as { size?: unknown; mimetype?: unknown };
    return { size: typeof meta.size === "number" ? meta.size : 0, mimetype: typeof meta.mimetype === "string" ? meta.mimetype : "" };
  }

  async remove(bucket: string, paths: string[]) {
    if (paths.length === 0) return;
    const { error } = await this.db.storage.from(bucket).remove(paths);
    if (error) throw new Error(error.message);
  }

  async download(bucket: string, path: string) {
    const { data, error } = await this.db.storage.from(bucket).download(path);
    if (error || !data) throw new Error(error?.message ?? "Could not read file");
    return new Uint8Array(await data.arrayBuffer());
  }

  async upload(bucket: string, path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.db.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
    if (error) throw new Error(error.message);
  }

  private async signNow(bucket: string, paths: string[], seconds: number) {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const { data, error } = await this.db.storage.from(bucket).createSignedUrls(paths, seconds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
    return out;
  }

  async createReadUrls(bucket: string, paths: string[], seconds: number) {
    if (!KEEP_BUCKETS.has(bucket)) return this.signNow(bucket, paths, seconds);
    const now = Date.now();
    const unique = [...new Set(paths)];
    // Signed for at least two hours, handed out while it still has the time asked for (so never less than today).
    const missing = unique.filter((p) => (kept.get(`${bucket}/${p}`)?.until ?? 0) - now < seconds * 1000);
    // This render's links, taken before any clearing below.
    const got = new Map(unique.filter((p) => !missing.includes(p)).map((p) => [p, kept.get(`${bucket}/${p}`)!.url]));
    if (missing.length) {
      const life = Math.max(2 * seconds, 7200);
      const until = now + life * 1000;
      const signing = this.signNow(bucket, missing, life);
      room(now, missing.length);
      for (const p of missing) {
        const key = `${bucket}/${p}`;
        const url = signing.then((m) => m.get(p) ?? null);
        kept.set(key, { url, until });
        got.set(p, url);
        // A failed signing or a missing file is forgotten, so the next render asks again.
        url.then(
          (u) => u === null && kept.get(key)?.until === until && kept.delete(key),
          () => kept.get(key)?.until === until && kept.delete(key),
        );
      }
    }
    const out = new Map<string, string>();
    const urls = await Promise.all(unique.map((p) => got.get(p) ?? Promise.resolve(null)));
    unique.forEach((p, i) => urls[i] && out.set(p, urls[i]!));
    return out;
  }
}

export function getFileStorage(): FileStorage {
  return new SupabaseFileStorage();
}

export const BRIEF_FILES_BUCKET = "contest-files";
export { BRIEF_FILE_EXT as BRIEF_FILE_TYPES } from "@/lib/contests/brief-file-rules";
