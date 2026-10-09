import "server-only";
import { brandPictures } from "./brand";

/**
 * Browser and home-screen icon (A-17): the admin's uploaded icon, or the built-in file. A short
 * redirect keeps it simple; browsers follow it for icons. Errors fall back to the built-in file.
 */
export async function iconResponse(builtIn: string): Promise<Response> {
  const uploaded = await brandPictures().then((p) => p.icon).catch(() => null);
  return new Response(null, { status: 307, headers: { Location: uploaded ?? builtIn, "Cache-Control": "public, max-age=300" } });
}
