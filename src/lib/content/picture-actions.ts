"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { SETTINGS } from "@/lib/settings/registry";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPictureKind, PICTURE_MAX_BYTES, PICTURE_TYPES, picturePathPattern, SITE_BUCKET, type PictureKind } from "./pictures";

type Fail = { ok: false; error: MessageKey };
const fail = (error: MessageKey): Fail => ({ ok: false, error });

async function storedPath(kind: PictureKind): Promise<string> {
  const { data } = await createAdminClient().from("settings").select("value").eq("key", `brand.${kind}`).maybeSingle();
  return typeof data?.value === "string" ? data.value : "";
}

async function setPath(kind: PictureKind, path: string, adminId: string) {
  const key = `brand.${kind}` as const;
  const def = SETTINGS[key];
  return createAdminClient().from("settings").upsert({ key, value: path, type: def.type, group: def.group, description: def.description, updated_by: adminId });
}

/** A-17 picture step 1: a one-time upload link for an admin, after checking the file type and size. */
export async function prepareSitePicture(kind: string, input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!(await adminUser("content.manage"))) return fail("auth.errors.generic");
  if (!isPictureKind(kind)) return fail("auth.errors.generic");
  const ext = PICTURE_TYPES[kind][input.type];
  if (!ext) return fail(`admin.brand.pictures.types.${kind}`);
  if (input.size <= 0 || input.size > PICTURE_MAX_BYTES) return fail("admin.brand.pictures.tooBig");
  const upload = await getFileStorage().createUploadUrl(SITE_BUCKET, `${kind}/${randomUUID()}.${ext}`);
  return { ok: true, ...upload };
}

/** A-17 picture step 2: checks the upload and makes it the site's picture; the old file is deleted. */
export async function saveSitePicture(kind: string, path: string): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin || !isPictureKind(kind) || !picturePathPattern(kind).test(path)) return fail("auth.errors.generic");
  const storage = getFileStorage();
  if (!(await storage.exists(SITE_BUCKET, path))) return fail("auth.errors.generic");
  const old = await storedPath(kind);
  const { error } = await setPath(kind, path, admin.id);
  if (error) return fail("admin.errors.generic");
  if (old && old !== path) await storage.remove(SITE_BUCKET, [old]).catch(() => {});
  await audit(admin.id, "update_picture", "site_picture", kind, { from: old || null, to: path });
  refresh();
  return { ok: true };
}

/** A-17 "Use default": back to the built-in picture; the uploaded file is deleted. */
export async function removeSitePicture(kind: string): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin || !isPictureKind(kind)) return fail("auth.errors.generic");
  const old = await storedPath(kind);
  const { error } = await setPath(kind, "", admin.id);
  if (error) return fail("admin.errors.generic");
  if (old) await getFileStorage().remove(SITE_BUCKET, [old]).catch(() => {});
  await audit(admin.id, "update_picture", "site_picture", kind, { from: old || null, to: null });
  refresh();
  return { ok: true };
}
