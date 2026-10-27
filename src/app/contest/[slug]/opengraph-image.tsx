import { ImageResponse } from "next/og";
import { asJpeg } from "@/lib/share/design";
import { isSupabaseConfigured } from "@/lib/env";
import { contestStatusLine, isLatin, logoDataUrl, OG_SIZE, OgFrame } from "@/lib/og";
import { contestIndexable } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";

export const alt = "A logo design contest on logocontest.bd";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

// Contest share card (BLUEPRINT §15.1): brand, prize, status. Hidden contests show only the contest number.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: c } =
    isSupabaseConfigured() && /^[a-z0-9-]{1,120}$/.test(slug)
      ? await createAdminClient().from("contests").select("brand_name, prize_amount, status, ends_at, is_private, is_nda, contest_number").eq("slug", slug).maybeSingle()
      : { data: null };
  const visible = c && contestIndexable({ status: c.status as string, isPrivate: Boolean(c.is_private), isNda: Boolean(c.is_nda) });
  const brand = visible && isLatin(c.brand_name as string) ? (c.brand_name as string) : null;
  const number = c?.contest_number ? `Contest #${String(c.contest_number).padStart(5, "0")}` : "Logo contest";
  const status = visible ? contestStatusLine(c.status as string, (c.ends_at as string | null) ?? null) : null;

  return asJpeg(
    new ImageResponse(
      (
        <OgFrame logoSrc={await logoDataUrl()}>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, color: "#8b0000", textTransform: "uppercase" }}>{number}</span>
          <span style={{ marginTop: 12, fontSize: brand && brand.length > 18 ? 72 : 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{brand ?? "Logo design contest"}</span>
          {visible && (
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 28 }}>
              <span style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#fff", background: "#8b0000", borderRadius: 20, padding: "10px 26px" }}>
                Prize BDT {Number(c.prize_amount).toLocaleString("en-US")}
              </span>
              {status && <span style={{ fontSize: 34, color: "#5c4a3d" }}>{status}</span>}
            </div>
          )}
        </OgFrame>
      ),
      size,
    ),
  );
}
