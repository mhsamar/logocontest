/**
 * Design check (owner, 2026-10-15; 2026-10-17: nudity only). Before a new design is published, the AI looks at its
 * pictures for one thing: nude or sexual content. Mockups of every kind (clothes, people, app icons, screens, photos)
 * are fine, because designers show logos in many ways. A picture that is sexual, or that the AI isn't sure about,
 * holds the whole design for Admin › Designs › To approve; the designer's other designs publish as usual. If the check
 * can't run the design is published (never blocked). Pure: the prompt, the answer's shape and its reading are tested.
 */

export const ADULT_LEVELS = ["no", "unsure", "yes"] as const;
export type AdultLevel = (typeof ADULT_LEVELS)[number];

export const RELEVANCE_TOOL = {
  name: "picture_check",
  description: "For each numbered picture: does it show nude or sexual content, and what does it show.",
  input_schema: {
    type: "object",
    properties: {
      images: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The picture's number, starting at 1." },
            adult: { type: "string", enum: [...ADULT_LEVELS], description: "yes = nude or sexual; unsure = you can't tell; no = anything else." },
            what: { type: "string", description: "A few plain English words saying what the picture shows." },
          },
          required: ["n", "adult", "what"],
        },
      },
    },
    required: ["images"],
  },
};

/** The instructions: only nudity and sexual content matter; everything else is allowed. */
export function relevancePrompt(input: { service: string; brand: string | null; count: number }): string {
  return [
    "You check pictures that designers send to a design contest on logocontest.bd, a site in Bangladesh.",
    `The contest asks for: ${input.service}${input.brand ? ` for the brand "${input.brand}"` : ""}.`,
    `You get ${input.count} numbered picture${input.count === 1 ? "" : "s"} from one design.`,
    "",
    "Only one thing matters: nude or sexual content. Do not judge whether the picture is a good design or even a design.",
    "adult = no for everything else: a logo on its own or on any mockup (clothes, a person wearing it, a robot, a sign, a cup, a bag, app icons, a phone or website screen), photos, screenshots, text, sketches, colour boards, anything strange or unrelated.",
    "adult = yes when the picture shows nudity (bare breasts, buttocks or genitals), sexual acts, sexual poses, sex toys, or sexual drawings, even small or in the background.",
    "adult = unsure when you can't tell whether it is sexual: underwear or lingerie, very revealing clothes, a suggestive pose, a blurry or cropped body.",
    "Answer for every picture, in order.",
  ].join("\n");
}

export type RelevanceAnswer = { held: boolean; positions: number[]; reason: string };

/** The AI's answer, checked: which pictures (0-based positions) are sexual or doubtful, and a short reason for the team. */
export function readRelevance(raw: unknown, count: number): RelevanceAnswer | null {
  const list = raw && typeof raw === "object" ? (raw as { images?: unknown }).images : null;
  if (!Array.isArray(list)) return null;
  const off: { position: number; what: string; level: Exclude<AdultLevel, "no"> }[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as { n?: unknown; adult?: unknown; what?: unknown };
    const n = typeof r.n === "number" ? Math.round(r.n) : NaN;
    const level = typeof r.adult === "string" ? r.adult.trim().toLowerCase() : "";
    if (!(n >= 1 && n <= count) || (level !== "yes" && level !== "unsure")) continue;
    if (off.some((o) => o.position === n - 1)) continue;
    off.push({ position: n - 1, level, what: typeof r.what === "string" ? r.what.replace(/\s+/g, " ").trim().slice(0, 80) : "" });
  }
  off.sort((a, b) => a.position - b.position);
  const reason = off.map((o) => `Picture ${o.position + 1}: ${o.level === "yes" ? "sexual content" : "may be sexual"}${o.what ? ` (${o.what})` : ""}`).join("; ").slice(0, 500);
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
