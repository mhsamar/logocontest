import { ImageResponse } from "next/og";
import { DesignPinFacts, logoDataUrl, PIN_SIZE, PinFrame } from "@/lib/og";
import { asJpeg, designFacts, pictureDataUrl, sharedDesign } from "@/lib/share/design";

// One design's Pinterest picture (owner, 2026-10-18): tall, the design big with its facts under it. Only for designs
// that may be shared (lib/entries/rules isShareableDesign); anything else is "not found".
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; number: string }> }) {
  const { slug, number } = await params;
  const [shared, logoSrc] = await Promise.all([sharedDesign(slug, Number(number)), logoDataUrl()]);
  const picture = shared ? await pictureDataUrl(shared.entry.previews[0]) : null;
  if (!shared || !picture) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return asJpeg(new ImageResponse(
    (
      <PinFrame logoSrc={logoSrc} picture={picture}>
        <DesignPinFacts facts={designFacts(shared)} />
      </PinFrame>
    ),
    PIN_SIZE,
  ));
}
