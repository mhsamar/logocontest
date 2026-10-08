import { type NextRequest } from "next/server";
import { designerByUsername } from "@/lib/designers/profile";
import { siteOrigin } from "@/lib/email";
import { qrPng } from "@/lib/profile/qr";

/** PNG QR code of a designer's public profile; `?download=1` saves it as a file (P-06, D-02). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const designer = await designerByUsername(username);
  if (!designer) return new Response("Not found", { status: 404 });
  const png = await qrPng(`${await siteOrigin()}/d/${designer.username}`);
  const headers: Record<string, string> = { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" };
  if (request.nextUrl.searchParams.get("download")) headers["Content-Disposition"] = `attachment; filename="logocontest-${designer.username}-qr.png"`;
  return new Response(new Uint8Array(png), { headers });
}
