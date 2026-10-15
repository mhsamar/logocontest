/**
 * Design check (owner, 2026-10-15): before a new design is published, the AI looks at its pictures. A picture that
 * isn't a design for the contest (an app or website screenshot, a chat, a document, a random photo, a meme, a blank
 * or test picture) holds the whole design for Admin › Designs › To approve; the designer's other designs publish as
 * usual. When in doubt the AI says "related", and if the check can't run the design is published (never blocked).
 * Pure: the prompt, the answer's shape and its reading are tested.
 */

export const RELEVANCE_TOOL = {
  name: "design_check",
  description: "For each numbered picture: is it a design made for this contest, and what does it show.",
  input_schema: {
    type: "object",
    properties: {
      images: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The picture's number, starting at 1." },
            related: { type: "boolean", description: "True when it is a design for this contest (or you are not sure)." },
            what: { type: "string", description: "A few plain English words saying what the picture shows." },
          },
          required: ["n", "related", "what"],
        },
      },
    },
    required: ["images"],
  },
};

/** What the contest asks for, in plain words, for the instructions. */
export function relevancePrompt(input: { service: string; brand: string | null; count: number }): string {
  return [
    "You check designs that designers send to a design contest on logocontest.bd, a site in Bangladesh.",
    `The contest asks for: ${input.service}${input.brand ? ` for the brand "${input.brand}"` : ""}.`,
    `You get ${input.count} numbered picture${input.count === 1 ? "" : "s"} from one design.`,
    "",
    "related = true for anything that is part of a design for this contest: the design on its own, on a mockup (sign, card, cup, shirt, bag, packet, screen or phone showing the design), sketches, colour versions, presentation boards, a black or white version. The brand name may be missing or spelled differently; the style may be simple or poor: still related.",
    "related = false only when the picture clearly is not a design for this contest: a screenshot of an app, website, social media, chat, form, document or code; a photo or selfie with no design in it; a meme or joke picture; a blank, test or placeholder picture; plain text notes; a picture with nothing to do with the brief.",
    "If you are not sure, answer related = true. Answer for every picture, in order.",
  ].join("\n");
}

export type RelevanceAnswer = { held: boolean; positions: number[]; reason: string };

/** The AI's answer, checked: which pictures (0-based positions) are not designs, and a short reason for the team. */
export function readRelevance(raw: unknown, count: number): RelevanceAnswer | null {
  const list = raw && typeof raw === "object" ? (raw as { images?: unknown }).images : null;
  if (!Array.isArray(list)) return null;
  const off: { position: number; what: string }[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as { n?: unknown; related?: unknown; what?: unknown };
    const n = typeof r.n === "number" ? Math.round(r.n) : NaN;
    if (!(n >= 1 && n <= count) || r.related !== false) continue;
    if (off.some((o) => o.position === n - 1)) continue;
    off.push({ position: n - 1, what: typeof r.what === "string" ? r.what.replace(/\s+/g, " ").trim().slice(0, 80) : "" });
  }
  off.sort((a, b) => a.position - b.position);
  const reason = off.map((o) => `Picture ${o.position + 1}: ${o.what || "not a design"}`).join("; ").slice(0, 500);
  return { held: off.length > 0, positions: off.map((o) => o.position), reason };
}

/**
 * A picture of a design was removed (owner, 2026-10-16: by its designer while the contest is open, or by the team in
 * To approve). `remaining` are the old 0-based positions still there, in order; they become 0, 1, 2…
 * The doubted pictures and the reason follow: the removed picture drops out and the rest are renumbered.
 * No doubted picture left means the design no longer needs a check.
 */
export function heldAfterRemoval(held: { positions: number[]; reason: string }, remaining: number[]): { positions: number[]; reason: string; clear: boolean } {
  const next = new Map(remaining.map((old, i) => [old, i]));
  const positions = held.positions.flatMap((p) => (next.has(p) ? [next.get(p)!] : [])).sort((a, b) => a - b);
  const reason = held.reason
    .split(/;\s*(?=Picture \d+:)/)
    .flatMap((part) => {
      const m = /^Picture (\d+):\s*(.*)$/.exec(part.trim());
      if (!m) return [];
      const to = next.get(Number(m[1]) - 1);
      return to === undefined || !positions.includes(to) ? [] : [`Picture ${to + 1}: ${m[2]}`];
    })
    .join("; ");
  return { positions, reason, clear: positions.length === 0 };
}
