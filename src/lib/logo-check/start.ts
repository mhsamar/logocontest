import "server-only";
import { randomUUID } from "node:crypto";
import type { CurrentUser } from "@/lib/auth/policies";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured } from "./ai";
import { CHECK_UPLOAD_MAX, CHECK_UPLOAD_TYPES, normalizeLogo } from "./images";
import { LOGO_CHECKS_BUCKET } from "./run";

/**
 * Starting a check (owner, 2026-10-10). The image is prepared and stored first, then one database call
 * checks every rule (owner, open or judging, free or paid, 3 per contest, design not checked yet) and is
 * safe against double clicks (the browser sends the same request key).
 */

export type StartError = "not_found" | "closed" | "locked" | "limit" | "checked" | "invalid" | "bad_file" | "too_big" | "not_set_up";
export type StartInput = { contestId: string; requestKey: string; entryId: string | null; file: File | null };

const UUID = /^[0-9a-f-]{36}$/i;

/** True when the AI and at least one web search are set up; without them a check can't give a real answer. */
export const checkerReady = () => aiConfigured() && Boolean(process.env.SEARCHAPI_API_KEY || process.env.GOOGLE_VISION_API_KEY);

export async function startCheck(user: CurrentUser, input: StartInput): Promise<{ ok: true; id: string } | { ok: false; error: StartError }> {
  if (!isSupabaseConfigured() || !checkerReady()) return { ok: false, error: "not_set_up" };
  if (!UUID.test(input.contestId) || !UUID.test(input.requestKey) || (input.entryId && !UUID.test(input.entryId))) return { ok: false, error: "invalid" };
  if (!input.entryId === !input.file) return { ok: false, error: "invalid" };
  const db = createAdminClient();
  const store = getFileStorage();

  // A double click: the first request already made the check.
  const { data: same } = await db.from("logo_checks").select("id, requested_by").eq("request_key", input.requestKey).maybeSingle();
  if (same) return same.requested_by === user.id ? { ok: true, id: same.id as string } : { ok: false, error: "invalid" };

  // The image: the design's first mockup, or the uploaded file.
  let raw: Uint8Array | null = null;
  if (input.entryId) {
    const { data: img } = await db
      .from("entry_images")
      .select("original_path, entry:entries!entry_id!inner(contest_id)")
      .eq("entry_id", input.entryId)
      .eq("entry.contest_id", input.contestId)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!img) return { ok: false, error: "not_found" };
    raw = await store.download(ENTRY_FILES_BUCKET, img.original_path as string).catch(() => null);
  } else if (input.file) {
    if (input.file.size > CHECK_UPLOAD_MAX) return { ok: false, error: "too_big" };
    if (!(CHECK_UPLOAD_TYPES as readonly string[]).includes(input.file.type)) return { ok: false, error: "bad_file" };
    raw = new Uint8Array(await input.file.arrayBuffer());
  }
  const png = raw && (await normalizeLogo(raw));
  if (!png) return { ok: false, error: "bad_file" };

  const id = randomUUID();
  const path = `${id}/logo.png`;
  await store.upload(LOGO_CHECKS_BUCKET, path, png, "image/png");
  const { data, error } = await db.rpc("start_logo_check", {
    p_id: id,
    p_request_key: input.requestKey,
    p_contest_id: input.contestId,
    p_user_id: user.id,
    p_entry_id: input.entryId,
    p_source: input.entryId ? "entry" : "upload",
    p_image_path: path,
  });
  const started = data as { id: string } | null;
  if (error || !started?.id) {
    await store.remove(LOGO_CHECKS_BUCKET, [path]).catch(() => undefined);
    const code = (["not_found", "closed", "locked", "limit", "checked", "invalid"] as const).find((c) => error?.message?.includes(c));
    return { ok: false, error: code ?? "invalid" };
  }
  // Two clicks raced past the first look: keep the first check, drop this copy of the image.
  if (started.id !== id) await store.remove(LOGO_CHECKS_BUCKET, [path]).catch(() => undefined);
  return { ok: true, id: started.id };
}
