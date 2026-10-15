import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { isSupabaseConfigured } from "@/lib/env";
import { isLatin } from "@/lib/og";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

let icon: Promise<string> | null = null;
const iconUrl = () => (icon ??= readFile(path.join(process.cwd(), "public/brand/logo-icon-white.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`));

/**
 * The contest picture in emails (owner, 2026-10-15): a small PNG tile in the site's red with the brand's first letter,
 * or the logo for private and NDA contests (their name never shows). 320×240, shown at 80×60.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: c } =
    isSupabaseConfigured() && /^[a-z0-9-]{1,120}$/.test(slug)
      ? await createAdminClient().from("contests").select("brand_name, is_private, is_nda").eq("slug", slug).maybeSingle()
      : { data: null };
  const letter = c && !c.is_private && !c.is_nda ? ((c.brand_name as string).trim()[0] ?? "").toUpperCase() : "";
  const showLetter = letter && isLatin(letter);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(120deg, #8B0000, #B3261E 55%, #D9A52B)" }}>
        {showLetter ? (
          <span style={{ fontSize: 150, fontWeight: 800, color: "#ffffff", lineHeight: 1 }}>{letter}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={await iconUrl()} width={150} height={150} alt="" />
        )}
      </div>
    ),
    { width: 320, height: 240, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
