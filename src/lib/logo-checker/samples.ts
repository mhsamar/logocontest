/**
 * Static example data for the public Logo Checker page (owner, 2026-10-13; Design/logo-checker). Nothing here comes
 * from a real check or a real client: the logos are neutral placeholders in public/logo-checker/ and every score
 * and percent is a sample.
 */

export type SampleVerdict = "no_match" | "similar" | "high_risk";
export type SampleSource = "web" | "site";

/** public/logo-checker/sample-NN.svg (the owner may replace these files with their own example images). */
export const sampleLogo = (n: number) => `/logo-checker/sample-${String(n).padStart(2, "0")}.svg`;

/** The three "Try a sample" logos in the hero, each with its own answer. */
export const HERO_SAMPLES: {
  id: "swoosh" | "frame" | "circle";
  logo: number;
  verdict: SampleVerdict;
  overall: number;
  finds: { logo: number; source: SampleSource; pct: number }[];
}[] = [
  { id: "swoosh", logo: 1, verdict: "high_risk", overall: 36, finds: [{ logo: 4, source: "web", pct: 84 }, { logo: 5, source: "web", pct: 41 }, { logo: 3, source: "site", pct: 22 }] },
  { id: "frame", logo: 2, verdict: "similar", overall: 69, finds: [{ logo: 8, source: "web", pct: 48 }, { logo: 6, source: "web", pct: 31 }, { logo: 12, source: "site", pct: 18 }] },
  { id: "circle", logo: 3, verdict: "no_match", overall: 86, finds: [{ logo: 11, source: "web", pct: 24 }, { logo: 10, source: "web", pct: 17 }, { logo: 9, source: "site", pct: 9 }] },
];

/** Logos found for the sample report's radar: closer to the centre = more similar. */
export const RADAR_FINDS: { id: "blue" | "black" | "green" | "purple" | "gold" | "wreath"; logo: number; pct: number; source: SampleSource; angle: number }[] = [
  { id: "blue", logo: 4, pct: 86, source: "web", angle: -55 },
  { id: "black", logo: 5, pct: 64, source: "web", angle: 35 },
  { id: "green", logo: 3, pct: 47, source: "web", angle: 130 },
  { id: "purple", logo: 7, pct: 33, source: "web", angle: 200 },
  { id: "gold", logo: 6, pct: 24, source: "web", angle: 268 },
  { id: "wreath", logo: 8, pct: 15, source: "site", angle: 88 },
];
/** How many images the sample search found in all (the radar shows the closest six). */
export const RADAR_FIND_COUNT = 9;

/** Sample report scores (out of 100). */
export const SAMPLE_SCORES = { overall: 38, uniqueness: 22, legibility: 84, colour: 77 };

/**
 * Where a found logo sits on the radar, in percent of the radar's box: the 75%, 50% and 25% rings are at radius
 * 15.5%, 27% and 38.5%, so the radius is 4 + 0.46 × (100 − similarity).
 */
export const radarRadius = (pct: number) => 4 + 0.46 * (100 - pct);
export function radarSpot(pct: number, angleDeg: number): { left: number; top: number } {
  const r = radarRadius(pct);
  const a = (angleDeg * Math.PI) / 180;
  return { left: Math.round((50 + r * Math.cos(a)) * 10) / 10, top: Math.round((50 + r * Math.sin(a)) * 10) / 10 };
}

/** Bar and number colour of a similarity: red when close, orange in between, green when far. */
export const pctColour = (pct: number) => (pct >= 60 ? "#C0161F" : pct >= 40 ? "#D9480F" : "#1F9D57");

export const VERDICT_COLOURS: Record<SampleVerdict, { fg: string; bg: string }> = {
  no_match: { fg: "#14633C", bg: "#E3F3EA" },
  similar: { fg: "#9A3412", bg: "#FFEDD5" },
  high_risk: { fg: "#A3121B", bg: "#FDE3E1" },
};
