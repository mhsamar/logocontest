import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Share-preview cards (BLUEPRINT §15.1). 1200×630; the built-in font covers Latin text only. */
export const OG_SIZE = { width: 1200, height: 630 };

let logo: Promise<string> | null = null;
/** The full logo as a data URL (read once). */
export function logoDataUrl(): Promise<string> {
  logo ??= readFile(path.join(process.cwd(), "public/brand/logo-full.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return logo;
}

/** True when the text can be drawn with the built-in Latin font. */
export const isLatin = (s: string) => /^[\x20-\x7E -ɏ]*$/.test(s);

const BG = "linear-gradient(135deg, #fff7e8 0%, #fdeef2 45%, #eef1ff 100%)";

export function OgFrame({ logoSrc, children }: { logoSrc: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "64px 72px", color: "#200e01", fontFamily: "Geist" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={420} height={62} alt="" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#5c4a3d" }}>
        <span>logocontest.bd</span>
        <span style={{ display: "flex", background: "#8b0000", color: "#fff", borderRadius: 999, padding: "12px 28px", fontSize: 24, fontWeight: 600 }}>Logo design contests in Bangladesh</span>
      </div>
    </div>
  );
}
