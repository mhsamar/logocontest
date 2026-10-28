import "server-only";
import { brandPictures } from "./brand";

/**
 * Browser and home-screen icon (A-17): the admin's uploaded icon, or the built-in file. A short
 * redirect keeps it simple; browsers follow it for icons. Errors fall back to the built-in file. The CDN keeps the
 * redirect for an hour and the icon itself comes through /api/site-img (owner, 2026-10-28: every new visitor fetched
 * it from Supabase).
 */
export async function iconResponse(builtIn: string): Promise<Response> {
  const uploaded = await brandPictures().then((p) => p.icon).catch(() => null);
  return new Response(null, { status: 307, headers: { Location: uploaded ?? builtIn, "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
