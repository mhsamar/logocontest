import "server-only";

/**
 * The AI part of the copyright checker (owner, 2026-10-10): Claude reads the logo, compares its shape with
 * each found image and writes the scores' sentences and the advice. Strict JSON through a forced tool call.
 */

const MODEL = () => process.env.LOGO_CHECK_MODEL || "claude-sonnet-5-5";
/** Claude Sonnet 5.5: $2 per million input tokens, $10 per million output tokens. */
const PRICE_IN = 2 / 1_000_000;
const PRICE_OUT = 10 / 1_000_000;

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Claude can't be used right now (no credit, a wrong key, or the service is down): not worth retrying. */
export class AiUnavailableError extends Error {}

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } };
export const textBlock = (text: string): Block => ({ type: "text", text });
export const imageBlock = (png: Uint8Array): Block => ({ type: "image", source: { type: "base64", media_type: "image/png", data: Buffer.from(png).toString("base64") } });

export type AiResult<T> = { data: T; costUsd: number };

async function callTool<T>(system: string, content: Block[], tool: { name: string; description: string; input_schema: object }, maxTokens: number, fetcher: typeof fetch = fetch): Promise<AiResult<T>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL(), max_tokens: maxTokens, system, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    // 401/403: bad key; 400 "credit balance"; 529: overloaded. The check fails with a clear message.
    if (res.status === 401 || res.status === 403 || res.status === 529 || /credit balance|workspace/i.test(body)) throw new AiUnavailableError(`Claude ${res.status}: ${body}`);
    throw new Error(`Claude ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const call = json.content?.find((c) => c.type === "tool_use" && c.name === tool.name);
  if (!call?.input) throw new Error("Claude gave no answer");
  const costUsd = (json.usage?.input_tokens ?? 0) * PRICE_IN + (json.usage?.output_tokens ?? 0) * PRICE_OUT;
  return { data: call.input as T, costUsd };
}

const SYSTEM =
  "You help a logo design contest site in Bangladesh check logos before a client picks a winner. " +
  "Be careful and factual. Never claim a logo is legally safe, copyright free or guaranteed. " +
  "Write short, plain English that a small business owner understands.";

// ---- 1. Reading the logo -----------------------------------------------------------------------------

export type Reading = {
  is_logo: boolean;
  shape: string;
  logo_type: "wordmark" | "lettermark" | "pictorial" | "abstract" | "mascot" | "emblem" | "combination";
  text: string;
  colors: string[];
  font_look: string;
  font_guess: string;
  description: string;
  tags: string[];
  legibility: { score: number; line: string };
  colour: { score: number; line: string };
};

const SCORE = { type: "object", properties: { score: { type: "integer", minimum: 0, maximum: 100 }, line: { type: "string", description: "One sentence." } }, required: ["score", "line"] };

export function readLogo(logo: Uint8Array, fetcher?: typeof fetch): Promise<AiResult<Reading>> {
  return callTool<Reading>(
    SYSTEM,
    [imageBlock(logo), textBlock("Read this logo. Describe only what you can see.")],
    {
      name: "logo_reading",
      description: "What the logo shows.",
      input_schema: {
        type: "object",
        properties: {
          is_logo: { type: "boolean", description: "False when the image is not a logo (a photo, a screenshot, empty)." },
          shape: { type: "string", description: "The main shape or symbol in a few words, e.g. 'diamond icon left of the name'." },
          logo_type: { type: "string", enum: ["wordmark", "lettermark", "pictorial", "abstract", "mascot", "emblem", "combination"] },
          text: { type: "string", description: "The letters the logo shows, exactly. Empty when there are none." },
          colors: { type: "array", items: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" }, maxItems: 6, description: "Main colours as hex, most used first. Leave out a plain white or transparent background." },
          font_look: { type: "string", description: "What the letters look like, e.g. 'bold geometric sans-serif, rounded corners'. Empty when there is no text." },
          font_guess: { type: "string", description: "A font it looks like, or empty. It is only a guess." },
          description: { type: "string", description: "One line about the logo." },
          tags: { type: "array", items: { type: "string" }, maxItems: 6, description: "Short tags: shape, style, colours." },
          legibility: { ...SCORE, description: "How easy the text is to read, small and large. 100 when there is no text to read but the mark is clear." },
          colour: { ...SCORE, description: "Colour choice and contrast, and whether it works in one colour." },
        },
        required: ["is_logo", "shape", "logo_type", "text", "colors", "font_look", "font_guess", "description", "tags", "legibility", "colour"],
      },
    },
    1200,
    fetcher,
  );
}

// ---- 4. Comparing shapes ----------------------------------------------------------------------------

export type ShapeMatch = { n: number; similarity: number; same: string[]; different: string[] };

/** Compares the logo with up to 5 found images in one call. `n` is the image's number in the call (1-5). */
export async function compareShapes(logo: Uint8Array, images: Uint8Array[], fetcher?: typeof fetch): Promise<AiResult<ShapeMatch[]>> {
  const content: Block[] = [textBlock("The logo being checked:"), imageBlock(logo)];
  images.forEach((img, i) => content.push(textBlock(`Found image ${i + 1}:`), imageBlock(img)));
  content.push(
    textBlock(
      "Compare each found image with the logo being checked. Look at the symbol, the overall shape and layout, the letterforms and the colours. " +
        "similarity: 100 = the same logo, 85+ = a near copy, 45-84 = a clearly similar idea, below 45 = only loosely alike. " +
        "Photos, products or unrelated pictures get a low score. Give up to 3 short points that are the same and up to 3 that are different.",
    ),
  );
  const r = await callTool<{ matches: ShapeMatch[] }>(
    SYSTEM,
    content,
    {
      name: "shape_matches",
      description: "How similar each found image is to the logo.",
      input_schema: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                n: { type: "integer", minimum: 1, maximum: 5 },
                similarity: { type: "integer", minimum: 0, maximum: 100 },
                same: { type: "array", items: { type: "string" }, maxItems: 3 },
                different: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
              required: ["n", "similarity", "same", "different"],
            },
          },
        },
        required: ["matches"],
      },
    },
    1500,
    fetcher,
  );
  return { data: r.data.matches ?? [], costUsd: r.costUsd };
}

// ---- 5. Scores' sentences and advice --------------------------------------------------------------

export type Summary = { uniqueness_line: string; overall_line: string; advice: string };

export function summarize(facts: string, fetcher?: typeof fetch): Promise<AiResult<Summary>> {
  return callTool<Summary>(
    SYSTEM,
    [
      textBlock(
        `Here is what a logo check found:\n${facts}\n\n` +
          "Write: one sentence explaining the uniqueness score, one sentence for the overall score, and 2 or 3 plain sentences of advice for the client " +
          "(for example: ask the designer to change something, ask for the font name and licence, or go ahead). Say 'looks like' about fonts, never as a fact.",
      ),
    ],
    {
      name: "check_summary",
      description: "Sentences for the result.",
      input_schema: {
        type: "object",
        properties: { uniqueness_line: { type: "string" }, overall_line: { type: "string" }, advice: { type: "string" } },
        required: ["uniqueness_line", "overall_line", "advice"],
      },
    },
    600,
    fetcher,
  );
}
