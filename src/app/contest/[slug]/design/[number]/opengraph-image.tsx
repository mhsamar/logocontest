import { ImageResponse } from "next/og";
import { DesignOg, logoDataUrl, OG_SIZE, OgFrame } from "@/lib/og";
import { designFacts, pictureDataUrl, SHARE_PICTURE_HEADERS, sharedDesign } from "@/lib/share/design";

export const alt = "A design on logocontest.bd";
export const size = OG_SIZE;
export const contentType = "image/png";

// One design's share card (owner, 2026-10-18): the design and its facts, for Facebook, WhatsApp and the like.
export default async function Image({ params }: { params: Promise<{ slug: string; number: string }> }) {
  const { slug, number } = await params;
  const [shared, logoSrc] = await Promise.all([sharedDesign(slug, Number(number)), logoDataUrl()]);
  const picture = shared ? await pictureDataUrl(shared.entry.previews[0]) : null;
  if (!shared || !picture)
    return new ImageResponse(
      (
        <OgFrame logoSrc={logoSrc}>
          <span style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>Logo design contest</span>
        </OgFrame>
      ),
      size,
    );
  return new ImageResponse(<DesignOg logoSrc={logoSrc} picture={picture} facts={designFacts(shared)} />, { ...size, headers: SHARE_PICTURE_HEADERS });
}
