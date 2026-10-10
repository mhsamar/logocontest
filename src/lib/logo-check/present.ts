import type { CheckLimits, Verdict } from "./rules";

/**
 * Certificate wording (English, like the certificate design). "Where we searched" names only the sources that
 * really ran (owner, 2026-10-10: never say Google Lens unless Google Lens was searched).
 */

type SourcesLike = {
  lens: { ran: boolean; found: number };
  vision: { ran: boolean; found: number };
  site: { ran: boolean; found: number; close: number };
  shape: { compared: number; close: number; closest: number };
  font: { look: string; guess: string; hasText: boolean };
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function checkHeadline(verdict: Verdict, s: SourcesLike, limits: Pick<CheckLimits, "highRiskFrom">): { headline: string; subline: string } {
  const closest = s.shape.closest;
  if (verdict === "high_risk") return { headline: "High risk: a very close logo exists", subline: `Closest match: ${closest}% similar. Talk to the designer before you pick this logo.` };
  if (verdict === "similar") return { headline: `${plural(s.shape.close, "similar logo", "similar logos")} found`, subline: `Closest match: ${closest}% similar. No logo above ${limits.highRiskFrom}% was found.` };
  return { headline: "No close match found", subline: closest > 0 ? `Closest image found: ${closest}% similar.` : "Nothing similar was found in the places we searched." };
}

export function sourceRows(s: SourcesLike): { label: string; found: string }[] {
  const rows: { label: string; found: string }[] = [];
  if (s.lens.ran) rows.push({ label: "Google Lens image search", found: s.lens.found ? plural(s.lens.found, "image found", "images found") : "Nothing found" });
  if (s.vision.ran) rows.push({ label: "Google image search (Cloud Vision)", found: s.vision.found ? plural(s.vision.found, "image found", "images found") : "Nothing found" });
  if (s.site.ran) rows.push({ label: "Logos on logocontest.bd", found: s.site.close ? plural(s.site.close, "similar design", "similar designs") : "Nothing similar" });
  rows.push({ label: "Shape match by AI", found: s.shape.close ? `${s.shape.close} close · closest ${s.shape.closest}%` : s.shape.compared ? `Nothing close · ${plural(s.shape.compared, "image", "images")} compared` : "Nothing to compare" });
  rows.push({ label: "Font check", found: !s.font.hasText ? "No text in the logo" : s.font.guess ? `Looks like ${s.font.guess}` : "Checked" });
  return rows;
}
