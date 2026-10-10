import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * File storage behind an interface (BLUEPRINT §4). The browser uploads straight
 * to a one-time signed URL, so files never pass through our server.
 */
export interface FileStorage {
  createUploadUrl(bucket: string, path: string): Promise<{ path: string; token: string }>;
  exists(bucket: string, path: string): Promise<boolean>;
  remove(bucket: string, paths: string[]): Promise<void>;
  /** Reads a stored file (for server-side checks such as image moderation). */
  download(bucket: string, path: string): Promise<Uint8Array>;
  /** Writes a file from the server (overwrites). */
  upload(bucket: string, path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Short-lived links to read private files. Missing files are left out. */
  createReadUrls(bucket: string, paths: string[], seconds: number): Promise<Map<string, string>>;
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

  async createReadUrls(bucket: string, paths: string[], seconds: number) {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const { data, error } = await this.db.storage.from(bucket).createSignedUrls(paths, seconds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
    return out;
  }
}

export function getFileStorage(): FileStorage {
  return new SupabaseFileStorage();
}

export const BRIEF_FILES_BUCKET = "contest-files";
export const BRIEF_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
