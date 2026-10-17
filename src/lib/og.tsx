import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Share-preview cards (BLUEPRINT §15.1). 1200×630; the built-in font covers Latin text only. */
export const OG_SIZE = { width: 1200, height: 630 };

let logo: Promise<string> | null = null;
/** The logo (cropped to its edges) as a data URL (read once). */
export function logoDataUrl(): Promise<string> {
  logo ??= readFile(path.join(process.cwd(), "public/brand/logo-wordmark.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  return logo;
}

/** True when the text can be drawn with the built-in Latin font. */
export const isLatin = (s: string) => /^[\x20-\x7E -ɏ]*$/.test(s);

const BG = "linear-gradient(135deg, #fff7e8 0%, #fdeef2 45%, #eef1ff 100%)";

export function OgFrame({ logoSrc, children }: { logoSrc: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "64px 72px", color: "#200e01", fontFamily: "Geist" }}>
      {/* The logo cropped to its edges, 455×70, so it lines up with the text (owner, 2026-10-15: new logo with the star). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={390} height={60} alt="" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, color: "#5c4a3d" }}>
        <span>logocontest.bd</span>
        <span style={{ display: "flex", background: "#8b0000", color: "#fff", borderRadius: 999, padding: "12px 28px", fontSize: 24, fontWeight: 600 }}>Logo design contests in Bangladesh</span>
      </div>
    </div>
  );
}

/** Pinterest pictures (owner, 2026-10-18): tall 2:3, the shape Pinterest shows best. */
export const PIN_SIZE = { width: 1000, height: 1500 };

const RED = "#8b0000";
const BROWN = "#5c4a3d";

/** Facts under a shared design: number, brand, designer and the winner mark. Brand and name only when Latin. */
type DesignFacts = { number: number; brand: string | null; by: string | null; winner: boolean };

function WinnerPill({ size }: { size: number }) {
  return (
    <span style={{ display: "flex", alignSelf: "flex-start", fontSize: size, fontWeight: 700, color: "#fff", background: RED, borderRadius: 999, padding: `${size * 0.35}px ${size}px`, marginBottom: size * 0.7 }}>
      Winning design
    </span>
  );
}

/** One design for Facebook, WhatsApp and the like: the design on the left, its facts on the right (1200×630). */
export function DesignOg({ logoSrc, picture, facts }: { logoSrc: string; picture: string; facts: DesignFacts }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: BG, color: "#200e01", fontFamily: "Geist" }}>
      <div style={{ width: 630, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} width={630} height={630} alt="" style={{ objectFit: "contain" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "52px 52px 44px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={286} height={44} alt="" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {facts.winner && <WinnerPill size={22} />}
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: 4, color: RED, textTransform: "uppercase" }}>{`Design #${facts.number}`}</span>
          <span style={{ marginTop: 10, fontSize: facts.brand && facts.brand.length > 14 ? 50 : 66, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>{facts.brand ?? "Logo design"}</span>
          {facts.by && <span style={{ marginTop: 16, fontSize: 28, color: BROWN }}>{`by ${facts.by}`}</span>}
        </div>
        <span style={{ fontSize: 24, color: BROWN }}>Logo design contests in Bangladesh · logocontest.bd</span>
      </div>
    </div>
  );
}

/**
 * The tall Pinterest picture: our logo, the picture (a design, or a contest's leading design) and the facts under it.
 * With no picture, the text fills the space.
 */
export function PinFrame({ logoSrc, picture, children }: { logoSrc: string; picture: string | null; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "56px 60px 52px", color: "#200e01", fontFamily: "Geist" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} width={390} height={60} alt="" />
      {picture && (
        <div style={{ marginTop: 40, width: 880, height: 880, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 36, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={picture} width={880} height={880} alt="" style={{ objectFit: "contain" }} />
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, color: BROWN }}>
        <span>logocontest.bd</span>
        <span style={{ display: "flex", background: RED, color: "#fff", borderRadius: 999, padding: "14px 30px", fontSize: 26, fontWeight: 600 }}>Logo design contests in Bangladesh</span>
      </div>
    </div>
  );
}

/** The facts of one design under its picture on a Pinterest picture. */
export function DesignPinFacts({ facts }: { facts: DesignFacts }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {facts.winner && <WinnerPill size={26} />}
      <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, color: RED, textTransform: "uppercase" }}>{`Design #${facts.number}`}</span>
      <span style={{ marginTop: 8, fontSize: facts.brand && facts.brand.length > 18 ? 64 : 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{facts.brand ?? "Logo design"}</span>
      {facts.by && <span style={{ marginTop: 14, fontSize: 34, color: BROWN }}>{`by ${facts.by}`}</span>}
    </div>
  );
}

const STATUS: Record<string, string> = {
  judging: "Judging",
  winner_selected: "Winner picked",
  handover: "Winner picked",
  completed: "Completed",
  no_result: "Ended",
};

/** "Open · 3 days left", "Judging", "Completed": a contest's state on its share pictures. */
export function contestStatusLine(status: string, endsAt: string | Date | null, now = Date.now()): string | null {
  if (status !== "open") return STATUS[status] ?? null;
  const days = endsAt ? Math.ceil((new Date(endsAt).getTime() - now) / 86_400_000) : 0;
  return days > 0 ? `Open · ${days} day${days === 1 ? "" : "s"} left` : "Open";
}
