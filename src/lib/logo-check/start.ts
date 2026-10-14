import "server-only";
import { randomUUID } from "node:crypto";
import type { CurrentUser } from "@/lib/auth/policies";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured } from "./ai";
import { sha256Hex } from "./entry-links";
import { reuseDecision } from "./entry-rules";
import { CHECK_UPLOAD_MAX, CHECK_UPLOAD_TYPES, normalizeLogo } from "./images";
import { accessFor, limitFor } from "./rules";
import { checkLimits, LOGO_CHECKS_BUCKET } from "./run";

/**
 * Starting a check (owner, 2026-10-10). The image is prepared and stored first, then one database call
 * checks every rule (owner, open or judging, free or paid, checks left, design not checked yet) and is
 * safe against double clicks (the browser sends the same request key). Owner, 2026-10-13: a free contest gets 20
 * checks and the paid add-on 10 (Settings); the count is checked here too, before the image is prepared.
 */

export type StartError = "not_found" | "closed" | "locked" | "limit" | "checked" | "invalid" | "bad_file" | "too_big" | "not_set_up";
export type StartInput = { contestId: string; requestKey: string; entryId: string | null; file: File | null };

const UUID = /^[0-9a-f-]{36}$/i;

/** True when the AI and at least one web search are set up; without them a check can't give a real answer. */
export const checkerReady = () => aiConfigured() && Boolean(process.env.SEARCHAPI_API_KEY || process.env.GOOGLE_VISION_API_KEY);

export async function startCheck(user: CurrentUser, input: StartInput): Promise<{ ok: true; id: string; reused?: boolean } | { ok: false; error: StartError }> {
  if (!isSupabaseConfigured() || !checkerReady()) return { ok: false, error: "not_set_up" };
  if (!UUID.test(input.contestId) || !UUID.test(input.requestKey) || (input.entryId && !UUID.test(input.entryId))) return { ok: false, error: "invalid" };
  if (!input.entryId === !input.file) return { ok: false, error: "invalid" };
  const db = createAdminClient();
  const store = getFileStorage();

  // A double click: the first request already made the check.
  const { data: same } = await db.from("logo_checks").select("id, requested_by").eq("request_key", input.requestKey).maybeSingle();
  if (same) return same.requested_by === user.id ? { ok: true, id: same.id as string } : { ok: false, error: "invalid" };

  // Checks left: free and paid contests get different numbers.
  const { data: contest } = await db.from("contests").select("client_id, prize_amount, logo_scan, service").eq("id", input.contestId).maybeSingle();
  if (!contest || contest.client_id !== user.id) return { ok: false, error: "not_found" };
  // Logo contests only (owner, 2026-10-14): thumbnails, posts, covers, banners, cards, flyers and T-shirts can't use it.
  if (contest.service !== "logo") return { ok: false, error: "locked" };
  const limits = await checkLimits();
  const access = accessFor(contest.prize_amount as number, Boolean(contest.logo_scan), limits);
  if (access === "locked") return { ok: false, error: "locked" };

  // The image: the design's first mockup, or the uploaded file.
  let raw: Uint8Array | null = null;
  let sha: string | null = null;
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
    // A report for this exact file already exists (the designer's check, or an earlier one): reuse it, no check
    // used (owner, 2026-10-14). A report about an older file is taken off the design first.
    if (raw) {
      sha = sha256Hex(raw);
      const { data: prior } = await db.from("logo_checks").select("id, file_sha256").eq("entry_id", input.entryId).neq("status", "failed").maybeSingle();
      const decision = reuseDecision(prior ? { fileSha256: (prior.file_sha256 as string | null) ?? null } : null, sha);
      if (decision === "reuse") return { ok: true, id: prior!.id as string, reused: true };
      if (decision === "detach") await db.from("logo_checks").update({ entry_id: null }).eq("id", prior!.id);
    }
  } else if (input.file) {
    if (input.file.size > CHECK_UPLOAD_MAX) return { ok: false, error: "too_big" };
    if (!(CHECK_UPLOAD_TYPES as readonly string[]).includes(input.file.type)) return { ok: false, error: "bad_file" };
    raw = new Uint8Array(await input.file.arrayBuffer());
  }
  // Designers' contest checks don't use up the client's checks.
  const { count: used } = await db.from("logo_checks").select("id", { count: "exact", head: true }).eq("contest_id", input.contestId).neq("status", "failed").neq("source", "pre_submit");
  if ((used ?? 0) >= limitFor(contest.prize_amount as number, Boolean(contest.logo_scan), limits)) return { ok: false, error: "limit" };
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
  else await db.from("logo_checks").update({ file_sha256: sha ?? sha256Hex(raw!) }).eq("id", id);
  return { ok: true, id: started.id };
}
