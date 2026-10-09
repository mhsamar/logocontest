import { ImageResponse } from "next/og";
import { logoDataUrl, OG_SIZE, OgFrame } from "@/lib/og";

export const alt = "logocontest.bd — Many designers. Many ideas. One perfect logo.";
export const size = OG_SIZE;
export const contentType = "image/png";

// Site share card (BLUEPRINT §15.1), used by every page that has no card of its own.
export default async function Image() {
  return new ImageResponse(
    (
      <OgFrame logoSrc={await logoDataUrl()}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          <span>Many designers.</span>
          <span>Many ideas.</span>
          <span style={{ color: "#8b0000" }}>One perfect logo.</span>
        </div>
        <span style={{ marginTop: 24, fontSize: 32, color: "#5c4a3d" }}>Get your logo from Bangladesh&apos;s best designers.</span>
      </OgFrame>
    ),
    size,
  );
}
