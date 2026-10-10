"use server";

import { hasPermission, type Permission } from "@/lib/admin/permissions";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUser, one, UUID } from "./core";

/** One design as an admin looks at it, without leaving the admin panel (owner, 2026-10-10). */
export type AdminDesign = {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  story: string | null;
  images: { url: string; flagged: boolean }[];
  contest: { slug: string; brand: string; number: number | null; status: string };
  designer: { id: string; name: string; username: string | null };
  /** The older design an image was flagged as a near-duplicate of. */
  duplicateOf: { id: string; number: number; brand: string } | null;
  comments: { id: string; body: string; at: string; name: string; role: string; hidden: boolean }[];
};

/** Admin areas that show designs; any one of them may open the viewer. */
const AREAS: Permission[] = ["designs.view", "contests.view", "reports.view", "claims.view", "monthly.view", "content.view"];

export async function loadAdminDesign(entryId: string): Promise<AdminDesign | null> {
  const admin = await adminUser();
  if (!admin || !AREAS.some((p) => hasPermission(admin, p)) || !UUID.test(entryId) || !isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const { data: r } = await db
    .from("entries")
    .select(
      "id, number, status, created_at, logo_story, contest:contests!contest_id(slug, brand_name, contest_number, status), designer:profiles!designer_id(id, name, username), images:entry_images!entry_id(position, preview_path, duplicate_of_entry_id)",
    )
    .eq("id", entryId)
    .maybeSingle();
  if (!r) return null;

  const images = [...((r.images as { position: number; preview_path: string; duplicate_of_entry_id: string | null }[] | null) ?? [])].sort((a, b) => a.position - b.position);
  const dupId = images.find((i) => i.duplicate_of_entry_id)?.duplicate_of_entry_id ?? null;
  const [urls, comments, dup] = await Promise.all([
    getFileStorage()
      .createReadUrls(ENTRY_FILES_BUCKET, images.map((i) => i.preview_path), 3600)
      .catch(() => new Map<string, string>()),
    db
      .from("entry_comments")
      .select("id, body, created_at, is_hidden, author:profiles!user_id(name, role)")
      .eq("entry_id", entryId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200),
    dupId ? db.from("entries").select("id, number, contest:contests!contest_id(brand_name)").eq("id", dupId).maybeSingle() : null,
  ]);

  const c = one(r.contest as unknown as { slug: string; brand_name: string; contest_number: number | null; status: string } | null);
  const d = one(r.designer as unknown as { id: string; name: string; username: string | null } | null);
  return {
    id: r.id as string,
    number: r.number as number,
    status: r.status as string,
    createdAt: r.created_at as string,
    story: (r.logo_story as string | null) ?? null,
    images: images.flatMap((i) => (urls.get(i.preview_path) ? [{ url: urls.get(i.preview_path)!, flagged: Boolean(i.duplicate_of_entry_id) }] : [])),
    contest: { slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: c?.contest_number ?? null, status: c?.status ?? "" },
    designer: d ?? { id: "", name: "—", username: null },
    duplicateOf: dup?.data
      ? { id: dup.data.id as string, number: dup.data.number as number, brand: one(dup.data.contest as unknown as { brand_name: string } | null)?.brand_name ?? "" }
      : null,
    comments: (comments.data ?? []).map((m) => {
      const a = one(m.author as unknown as { name: string; role: string } | null);
      return { id: m.id as string, body: m.body as string, at: m.created_at as string, name: a?.name ?? "—", role: a?.role ?? "", hidden: Boolean(m.is_hidden) };
    }),
  };
}
