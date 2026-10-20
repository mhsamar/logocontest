import { NextResponse } from "next/server";
import { adminUser, UUID } from "@/lib/admin/core";
import { CARD_SIZES, contestCode, isCardSize } from "@/lib/cards/rules";
import { cardById, CARDS_BUCKET } from "@/lib/cards/store";
import { zipFiles } from "@/lib/cards/zip";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** "Download PNG" (one size) and "All sizes (.zip)" for Admin › Contest cards (owner, 2026-10-19). Auto share · view. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const admin = await adminUser("autoshare.view");
  if (!admin || !UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  const card = await cardById(id);
  if (!card) return new NextResponse("Not found", { status: 404 });
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("contest_number").eq("id", card.contest_id).maybeSingle();
  const base = `${c?.contest_number ? contestCode(c.contest_number as number) : "contest"}-${card.style}${card.kind === "last24" ? "-last24" : ""}`;
  const read = async (size: string) => {
    const path = card.images[size as keyof typeof card.images];
    if (typeof path !== "string") return null;
    const { data } = await db.storage.from(CARDS_BUCKET).download(path);
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  };
  if (file === "all.zip") {
    const files = [];
    for (const s of CARD_SIZES) {
      const data = await read(s.key);
      if (data) files.push({ name: `${base}-${s.key}.png`, data });
    }
    if (!files.length) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(Buffer.from(zipFiles(files)), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"`, "Cache-Control": "no-store" } });
  }
  const size = file.replace(/\.png$/, "");
  if (!isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  const data = await read(size);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(data), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${base}-${size}.png"`, "Cache-Control": "no-store" } });
}
