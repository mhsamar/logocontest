import "server-only";
import { getSetting } from "@/lib/settings";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { ENTRY_FILES_BUCKET } from "./queries";
import { heldAfterRemoval } from "./relevance-rules";

export type PictureRemoval = { ok: true; picture: number; published: boolean } | { ok: false; why: "notFound" | "last" | "failed" };

/**
 * Takes one picture off a design (owner, 2026-10-16): the designer while the contest is open, or the team in
 * Admin › Designs › To approve. The other pictures move up (the next one becomes the cover if the cover went) and
 * a design always keeps at least one picture; removing all of them is removing the design.
 * A held design whose last doubted picture went is published: `published` is then true and the caller tells people.
 * Who may do it is checked by the caller.
 */
export async function removePicture(entryId: string, imageId: string): Promise<PictureRemoval> {
  const db = createAdminClient();
  const [{ data: entry }, { data: images }] = await Promise.all([
    db.from("entries").select("id, status, held_positions, held_reason").eq("id", entryId).maybeSingle(),
    db.from("entry_images").select("id, position, original_path, preview_path").eq("entry_id", entryId).order("position"),
  ]);
  const list = (images ?? []) as { id: string; position: number; original_path: string; preview_path: string }[];
  const gone = list.find((i) => i.id === imageId);
  if (!entry || !gone) return { ok: false, why: "notFound" };
  if (list.length <= 1) return { ok: false, why: "last" };

  const { error } = await db.from("entry_images").delete().eq("id", gone.id).eq("entry_id", entryId);
  if (error) return { ok: false, why: "failed" };
  await getFileStorage()
    .remove(ENTRY_FILES_BUCKET, [gone.original_path, gone.preview_path])
    .catch((e) => console.error("[entries] picture files not removed:", e instanceof Error ? e.message : e));

  // 0, 1, 2… again, lowest first, so each picture moves into a free place.
  const rest = list.filter((i) => i.id !== gone.id);
  for (const [i, img] of rest.entries()) {
    if (img.position !== i) await db.from("entry_images").update({ position: i }).eq("id", img.id);
  }

  let published = false;
  if (entry.status === "held") {
    // While every design waits for approval (owner, 2026-10-20), taking a picture off never publishes the design.
    const keepWaiting = await getSetting("designs.approve_all").catch(() => false);
    const after = heldAfterRemoval({ positions: (entry.held_positions as number[] | null) ?? [], reason: (entry.held_reason as string | null) ?? "" }, rest.map((i) => i.position), keepWaiting);
    const { data } = await db
      .from("entries")
      .update({ held_positions: after.positions, held_reason: after.reason || null, ...(after.clear ? { status: "active" } : {}) })
      .eq("id", entryId)
      .eq("status", "held")
      .select("status")
      .maybeSingle();
    published = after.clear && data?.status === "active";
  }
  return { ok: true, picture: list.indexOf(gone) + 1, published };
}
