import "server-only";
import { randomUUID } from "node:crypto";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { BRIEF_FILES_BUCKET, getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRIEF_FILE_EXT, isBriefPath } from "./brief-file-rules";

/**
 * C-07 reference files without the "who may" part: the wizard, Edit details and the admin card each check the person
 * first, then call these. Not a "use server" file, so none of this is callable from the browser.
 */
export type BriefFileResult<T = object> = ({ ok: true } & T) | { ok: false; error: { key: MessageKey; params?: MessageParams } };

const fail = (key: MessageKey, params?: MessageParams) => ({ ok: false as const, error: { key, params } });

export async function briefFileLimits() {
  const s = await getSettings(["limits.brief_max_files", "limits.brief_file_max_mb"]);
  return { maxFiles: s["limits.brief_max_files"], maxBytes: s["limits.brief_file_max_mb"] * 1024 * 1024, maxMb: s["limits.brief_file_max_mb"] };
}

export async function briefFileCount(contestId: string) {
  const { count } = await createAdminClient().from("contest_files").select("id", { count: "exact", head: true }).eq("contest_id", contestId);
  return count ?? 0;
}

type FileIn = { name: string; type: string; size: number };

/** A one-time upload link for one file. `countLimit` false: the team may add more than a client can (owner, 2026-10-22). */
export async function createBriefUpload(contestId: string, f: FileIn, countLimit = true): Promise<BriefFileResult<{ path: string; token: string }>> {
  const limits = await briefFileLimits();
  const ext = BRIEF_FILE_EXT[f.type];
  if (!ext) return fail("wizard.errors.fileType", { name: f.name });
  if (!(f.size > 0) || f.size > limits.maxBytes) return fail("wizard.errors.fileSize", { name: f.name, mb: limits.maxMb });
  if (countLimit && (await briefFileCount(contestId)) >= limits.maxFiles) return fail("wizard.errors.fileCount", { max: limits.maxFiles });
  const upload = await getFileStorage().createUploadUrl(BRIEF_FILES_BUCKET, `${contestId}/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

/** Records an uploaded file. Anything refused here is removed from storage, so nothing is left behind. */
export async function saveBriefUpload(
  contestId: string,
  f: FileIn & { path: string; isCurrentLogo: boolean },
  countLimit = true,
): Promise<BriefFileResult<{ id: string }>> {
  if (!isBriefPath(contestId, f.path)) return fail("wizard.errors.generic");
  const storage = getFileStorage();
  const drop = () => dropBriefUpload(contestId, f.path);
  const limits = await briefFileLimits();
  if (!isBriefPath(contestId, f.path, f.type)) {
    await drop();
    return fail("wizard.errors.generic");
  }
  // The stored file itself, not what the browser says: its real type and size (the bucket only has a 50 MB, JPG/PNG/PDF
  // ceiling, 0072). Couldn't look: the upload may be there, so it goes (drop never touches a saved file).
  const stored = await storage.stat(BRIEF_FILES_BUCKET, f.path).catch(() => undefined);
  if (!stored) {
    if (stored === undefined) await drop();
    return fail("wizard.errors.generic");
  }
  if (stored.mimetype !== f.type || !(stored.size > 0)) {
    await drop();
    return fail("wizard.errors.fileType", { name: f.name });
  }
  if (stored.size > limits.maxBytes) {
    await drop();
    return fail("wizard.errors.fileSize", { name: f.name, mb: limits.maxMb });
  }
  if (countLimit && (await briefFileCount(contestId)) >= limits.maxFiles) {
    await drop();
    return fail("wizard.errors.fileCount", { max: limits.maxFiles });
  }

  const { data, error } = await createAdminClient()
    .from("contest_files")
    .insert({
      contest_id: contestId,
      type: f.isCurrentLogo ? "current_logo" : "example",
      path: f.path,
      original_name: f.name.slice(0, 200),
      mime_type: stored.mimetype,
      size_bytes: stored.size,
    })
    .select("id")
    .single();
  if (error || !data) {
    await drop();
    return fail("wizard.errors.generic");
  }
  // Checked again after saving: two saves at the same moment could both have passed the first count. The earliest
  // files keep their places and only the extra one is undone.
  if (countLimit) {
    const { data: first } = await createAdminClient()
      .from("contest_files")
      .select("id")
      .eq("contest_id", contestId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limits.maxFiles);
    if (first && !first.some((r) => r.id === data.id)) {
      const { error: undo } = await createAdminClient().from("contest_files").delete().eq("id", data.id);
      // Couldn't take it back: it stays saved, so say so (otherwise the browser keeps a second copy to send again).
      if (undo) return { ok: true, id: data.id as string };
      await drop();
      return fail("wizard.errors.fileCount", { max: limits.maxFiles });
    }
  }
  return { ok: true, id: data.id as string };
}

/** Deletes one of the contest's files (row, then the stored file). Returns its name, or null if it wasn't there. */
export async function deleteBriefFile(contestId: string, fileId: string): Promise<{ name: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return null;
  const { data } = await createAdminClient()
    .from("contest_files")
    .delete()
    .eq("id", fileId)
    .eq("contest_id", contestId)
    .select("path, original_name")
    .maybeSingle();
  if (!data) return null;
  await getFileStorage()
    .remove(BRIEF_FILES_BUCKET, [data.path as string])
    .catch(() => undefined);
  return { name: data.original_name as string };
}

/**
 * Removes an upload that can't be recorded (refused, or the contest closed meanwhile): only in this contest's folder,
 * and never a file that is already recorded (a retried call must not delete a saved photo).
 */
export async function dropBriefUpload(contestId: string, path: string) {
  if (!isBriefPath(contestId, path)) return;
  const { data, error } = await createAdminClient().from("contest_files").select("id").eq("path", path).limit(1);
  if (error || (data ?? []).length > 0) return;
  await getFileStorage()
    .remove(BRIEF_FILES_BUCKET, [path])
    .catch(() => undefined);
}
