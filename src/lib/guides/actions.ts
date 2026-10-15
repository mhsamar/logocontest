"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { SITE_BUCKET } from "@/lib/content/pictures";
import type { MessageKey } from "@/lib/i18n/translate";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { GUIDES_TAG } from "./queries";
import { bnReady, bodyPicturePaths, GUIDE_PICTURE_PATH, guideImageOk, guideProblems, PROBLEM_TEXT, type GuideInput } from "./rules";

/** Admin › Guides (owner, 2026-10-15). Viewing needs content.view, every change content.manage. */

type Fail = { ok: false; error: MessageKey };
const fail = (error: MessageKey): Fail => ({ ok: false, error });
const TABLE = "guides";
const SUPABASE = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
/** The browser makes pictures small first; this is the bucket's limit (migration 0028). */
const MAX_UPLOAD = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };


/** Clears the cached guides (pages, footer, sitemap) so a change shows at once. */
function changed() {
  updateTag(GUIDES_TAG);
  refresh();
}

/** A one-time upload link for a guide picture (a cover, or one in the text). */
export async function prepareGuidePicture(input: { type: string; size: number }): Promise<{ ok: true; path: string; token: string } | Fail> {
  if (!(await adminUser("content.manage"))) return fail("auth.errors.generic");
  const ext = TYPES[input.type];
  if (!ext) return fail("admin.guides.errors.pictureType");
  if (input.size <= 0 || input.size > MAX_UPLOAD) return fail("admin.guides.errors.pictureBig");
  return { ok: true, ...(await getFileStorage().createUploadUrl(SITE_BUCKET, `guides/${randomUUID()}.${ext}`)) };
}

const picturesOf = (g: { cover_path: string | null; body_en: string; body_bn: string }) => [g.cover_path, ...bodyPicturePaths(`${g.body_en}\n${g.body_bn}`, SUPABASE())].filter((p): p is string => Boolean(p));

/** Deletes pictures no guide uses any more. */
async function removeUnused(paths: string[]) {
  if (paths.length === 0) return;
  const { data } = await createAdminClient().from(TABLE).select("cover_path, body_en, body_bn");
  const used = new Set((data ?? []).flatMap((r) => picturesOf(r as { cover_path: string | null; body_en: string; body_bn: string })));
  const unused = [...new Set(paths)].filter((p) => GUIDE_PICTURE_PATH.test(p) && !used.has(p));
  if (unused.length) await getFileStorage().remove(SITE_BUCKET, unused).catch(() => {});
}

export type SaveGuideInput = GuideInput & { id: string | null };

export async function saveGuide(input: SaveGuideInput): Promise<{ ok: true; id: string; slug: string } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin) return fail("auth.errors.generic");
  if (!input || typeof input !== "object" || (input.id !== null && !UUID.test(String(input.id)))) return fail("auth.errors.generic");
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const g: GuideInput = {
    slug: str(input.slug).toLowerCase(),
    category: str(input.category),
    titleEn: str(input.titleEn),
    titleBn: str(input.titleBn),
    summaryEn: str(input.summaryEn),
    summaryBn: str(input.summaryBn),
    bodyEn: typeof input.bodyEn === "string" ? input.bodyEn.replace(/\r\n/g, "\n").trim() : "",
    bodyBn: typeof input.bodyBn === "string" ? input.bodyBn.replace(/\r\n/g, "\n").trim() : "",
    coverPath: typeof input.coverPath === "string" && input.coverPath ? input.coverPath : null,
    status: str(input.status),
    inFooter: input.inFooter === true,
  };
  const problems = guideProblems(g, guideImageOk(SUPABASE()));
  if (problems.length) return fail(PROBLEM_TEXT[problems[0]]);
  if (g.coverPath && !(await getFileStorage().exists(SITE_BUCKET, g.coverPath))) return fail("admin.guides.errors.cover");

  const db = createAdminClient();
  const { data: same } = await db.from(TABLE).select("id").eq("slug", g.slug).maybeSingle();
  if (same && same.id !== input.id) return fail("admin.guides.errors.slugTaken");

  const now = new Date().toISOString();
  const row = {
    slug: g.slug,
    category: g.category,
    title_en: g.titleEn,
    title_bn: g.titleBn,
    summary_en: g.summaryEn,
    summary_bn: g.summaryBn,
    body_en: g.bodyEn,
    body_bn: g.bodyBn,
    cover_path: g.coverPath,
    status: g.status,
    in_footer: g.inFooter,
    bn_ready: bnReady(g),
    updated_at: now,
    updated_by: admin.id,
  };
  let id = input.id;
  if (id) {
    const { data: old } = await db.from(TABLE).select("status, published_at, cover_path, body_en, body_bn").eq("id", id).maybeSingle();
    if (!old) return fail("admin.guides.errors.gone");
    // The first time it is published, the date is set; it stays when the guide is changed later.
    const publishedAt = g.status === "published" ? ((old.published_at as string | null) ?? now) : (old.published_at as string | null);
    const { error } = await db.from(TABLE).update({ ...row, published_at: publishedAt }).eq("id", id);
    if (error) return fail("admin.guides.errors.generic");
    await removeUnused(picturesOf(old as { cover_path: string | null; body_en: string; body_bn: string }));
    await audit(admin.id, "guide_update", "guide", id, { slug: g.slug, status: g.status, was: old.status });
  } else {
    const { data, error } = await db
      .from(TABLE)
      .insert({ ...row, published_at: g.status === "published" ? now : null, created_by: admin.id })
      .select("id")
      .single();
    if (error || !data) return fail("admin.guides.errors.generic");
    id = data.id as string;
    await audit(admin.id, "guide_create", "guide", id, { slug: g.slug, status: g.status });
  }
  changed();
  return { ok: true, id, slug: g.slug };
}

export async function deleteGuide(id: string): Promise<{ ok: true } | Fail> {
  const admin = await adminUser("content.manage");
  if (!admin || !UUID.test(id)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: old } = await db.from(TABLE).select("slug, title_en, cover_path, body_en, body_bn").eq("id", id).maybeSingle();
  if (!old) return fail("admin.guides.errors.gone");
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) return fail("admin.guides.errors.generic");
  await removeUnused(picturesOf(old as { cover_path: string | null; body_en: string; body_bn: string }));
  await audit(admin.id, "guide_delete", "guide", id, { slug: old.slug, title: old.title_en });
  changed();
  return { ok: true };
}
