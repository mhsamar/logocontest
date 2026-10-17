import "server-only";
import sharp from "sharp";
import { aiConfigured, callTool, jpegBlock, textBlock } from "@/lib/logo-check/ai";
import { getSetting } from "@/lib/settings";
import { readRelevance, RELEVANCE_TOOL, relevancePrompt, type RelevanceAnswer } from "./relevance-rules";

/** The check never keeps a designer waiting longer than this; past it the design is published. */
const CHECK_MS = 25_000;

/**
 * Design check (owner, 2026-10-15; 2026-10-17: nudity only): asks the AI whether any picture of a new logo design is
 * nude or sexual, or might be. null = not checked (switched off in Settings, no AI key, or the AI failed or was slow):
 * the design is published.
 */
export async function checkDesignPictures(input: { brand: string | null; files: Uint8Array[] }): Promise<RelevanceAnswer | null> {
  if (!aiConfigured() || input.files.length === 0) return null;
  try {
    if (!(await getSetting("designs.relevance_check"))) return null;
    // Small copies: enough to see what a picture shows, and cheap.
    const small = await Promise.all(input.files.map((f) => sharp(f).resize(448, 448, { fit: "inside" }).flatten({ background: "#ffffff" }).jpeg({ quality: 72 }).toBuffer()));
    const content = [textBlock(`Pictures 1 to ${small.length} follow.`), ...small.flatMap((jpg, i) => [textBlock(`Picture ${i + 1}:`), jpegBlock(jpg)])];
    const system = relevancePrompt({ service: "a logo design", brand: input.brand, count: small.length });
    const answer = await Promise.race([
      callTool<unknown>(system, content, RELEVANCE_TOOL, 800).then((r) => readRelevance(r.data, small.length)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CHECK_MS)),
    ]);
    if (!answer) console.warn("[design-check] no answer in time; published without the check");
    return answer;
  } catch (e) {
    console.error("[design-check]", e instanceof Error ? e.message : e);
    return null;
  }
}
