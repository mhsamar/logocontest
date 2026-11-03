import { isShareableDesign, type EntryStatus } from "@/lib/entries/rules";
import { requireEnv } from "@/lib/env";
import { convertedPicture } from "@/lib/storage/converted";
import { readPublicImageToken } from "@/lib/storage/view-links";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Row = {
  entry: {
    status: EntryStatus;
    is_hidden: boolean | null;
    contest: { status: string; is_private: boolean; is_nda: boolean; is_blind: boolean; winner_is_public: boolean; deleted_at: string | null } | null;
  } | null;
};

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * A public design's picture at an address that never changes (owner, 2026-11-03), so Google Images can keep the
 * designers' logos: /logo/<token>/<brand>-logo.webp. Checked on every load that the design is still public (a
 * logged-out visitor sees it, never an NDA contest's); the CDN keeps the picture for a day. A test client's public
 * contest shows its pictures here too: its pages are kept out of search engines instead.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; name: string }> }) {
  const { token, name } = await params;
  const t = readPublicImageToken(requireEnv("OTP_SECRET"), token);
  if (!t || !name.endsWith(".webp")) return notFound();
  const { data } = await createAdminClient()
    .from("entry_images")
    .select("entry:entries!entry_id(status, is_hidden, contest:contests!contest_id(status, is_private, is_nda, is_blind, winner_is_public, deleted_at))")
    .eq("preview_path", t.path)
    .limit(1)
    .maybeSingle();
  const e = (data as Row | null)?.entry;
  const c = e?.contest;
  if (!e || !c || c.deleted_at) return notFound();
  if (!isShareableDesign({ status: e.status, isHidden: e.is_hidden }, { status: c.status, isPrivate: c.is_private, isNda: c.is_nda, isBlind: c.is_blind, winnerIsPublic: c.winner_is_public })) return notFound();
  try {
    const webp = Buffer.from(await convertedPicture("entry-files", t.path, t.width), "base64");
    return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return notFound();
  }
}
