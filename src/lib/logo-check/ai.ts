import "server-only";

/**
 * The AI part of the copyright checker (owner, 2026-10-10): the AI reads the logo, compares its shape with each found
 * image and writes the scores' sentences and the advice, always as strict JSON.
 *
 * Two providers (owner, 2026-10-12: "Google AI Studio instead of Claude"): **Gemini** when GEMINI_API_KEY is set
 * (a Google AI Studio key), else **Claude** when ANTHROPIC_API_KEY is set. LOGO_CHECK_MODEL picks the model of the
 * provider in use (a "gemini-…" or "claude-…" name); otherwise each has a sensible default.
 */

type Provider = "gemini" | "claude";
const provider = (): Provider | null => (process.env.GEMINI_API_KEY ? "gemini" : process.env.ANTHROPIC_API_KEY ? "claude" : null);
const MODEL = (p: Provider) => {
  const set = process.env.LOGO_CHECK_MODEL ?? "";
  if (set.startsWith(p === "gemini" ? "gemini" : "claude")) return set;
  return p === "gemini" ? GEMINI_MODELS[0] : "claude-sonnet-5-5";
};
/**
 * Gemini models tried in order (tested 2026-10-12): Google's newest Flash models (and "gemini-flash-latest") were
 * so busy they hung for minutes, while 3.5 Flash answered in seconds. When one is busy, gone or out of quota, the
 * next is tried; LOGO_CHECK_MODEL, when set, goes first.
 */
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-flash-lite-latest"];
const geminiModels = () => [...new Set([MODEL("gemini"), ...GEMINI_MODELS])];
/** Each Gemini try gets this long, so a busy model leaves time for the next within the route's 300 s. */
const GEMINI_TRY_MS = 40_000;
/** Rough cost per token, for the admin's cost column (USD). */
const PRICES: Record<Provider, { in: number; out: number }> = {
  gemini: { in: 0.3 / 1_000_000, out: 2.5 / 1_000_000 },
  claude: { in: 2 / 1_000_000, out: 10 / 1_000_000 },
};

export const aiConfigured = () => provider() !== null;

/** The AI can't be used right now (no credit or quota, a wrong key, or the service is down): not worth retrying. */
export class AiUnavailableError extends Error {}

type Block = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string } };
export const textBlock = (text: string): Block => ({ type: "text", text });
export const imageBlock = (png: Uint8Array): Block => ({ type: "image", source: { type: "base64", media_type: "image/png", data: Buffer.from(png).toString("base64") } });
/** A small JPEG (the design check sends up to 8 at once, owner 2026-10-15). */
export const jpegBlock = (jpeg: Uint8Array): Block => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(jpeg).toString("base64") } });

/** costUsd from the built-in prices; tokens let the cost report use the admin's prices (owner, 2026-10-14). */
export type AiResult<T> = { data: T; costUsd: number; tokens: { in: number; out: number } };
export type Tool = { name: string; description: string; input_schema: object };

/** One structured answer from the AI (also used by the support assistant, owner 2026-10-15). */
export async function callTool<T>(system: string, content: Block[], tool: Tool, maxTokens: number, fetcher: typeof fetch = fetch): Promise<AiResult<T>> {
  const p = provider();
  if (p === "gemini") return callGemini<T>(system, content, tool, fetcher);
  if (p === "claude") return callClaude<T>(system, content, tool, maxTokens, fetcher);
  throw new Error("No AI key is set (GEMINI_API_KEY or ANTHROPIC_API_KEY)");
}

async function callClaude<T>(system: string, content: Block[], tool: Tool, maxTokens: number, fetcher: typeof fetch): Promise<AiResult<T>> {
  const key = process.env.ANTHROPIC_API_KEY!;
  const res = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL("claude"), max_tokens: maxTokens, system, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content }] }),
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
  const tokens = { in: json.usage?.input_tokens ?? 0, out: json.usage?.output_tokens ?? 0 };
  const costUsd = tokens.in * PRICES.claude.in + tokens.out * PRICES.claude.out;
  return { data: call.input as T, costUsd, tokens };
}

/**
 * The same JSON schema in the form Gemini's structured output accepts: upper-case types, and only the keywords it
 * knows (no `pattern`). Exported for tests.
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const s = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "type" && typeof v === "string") out.type = v.toUpperCase();
    else if (k === "properties" && v && typeof v === "object") out.properties = Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toGeminiSchema(pv)]));
    else if (k === "items") out.items = toGeminiSchema(v);
    else if (["description", "enum", "required", "maxItems", "minItems", "minimum", "maximum", "nullable", "format"].includes(k)) out[k] = v;
  }
  return out;
}

/**
 * When every model said "busy" at once (429 or 503), wait and ask again (owner, 2026-10-16: a check failed the first
 * time and worked the second). Not after a model was slow: that already used its time.
 */
export const BUSY_WAITS_MS = [3_000, 8_000];

async function callGemini<T>(system: string, content: Block[], tool: Tool, fetcher: typeof fetch, waits: number[] = BUSY_WAITS_MS): Promise<AiResult<T>> {
  let last: unknown;
  for (let round = 0; round <= waits.length; round++) {
    if (round > 0) await new Promise((r) => setTimeout(r, waits[round - 1]));
    let slow = false;
    for (const model of geminiModels()) {
      try {
        return await callGeminiModel<T>(model, system, content, tool, fetcher);
      } catch (e) {
        last = e;
        // A wrong key fails the same way on every model; a busy, missing or slow model may not.
        if (e instanceof AiUnavailableError && /API key not valid|API_KEY_INVALID/i.test(e.message)) throw e;
        const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        if (!(e instanceof GeminiBusyError) && !timedOut) throw e;
        if (timedOut) slow = true;
      }
    }
    if (slow) break;
  }
  throw new AiUnavailableError(`Gemini is busy: ${last instanceof Error ? last.message : String(last)}`);
}

/** This model is busy, gone or out of quota right now; another model may still answer. */
class GeminiBusyError extends Error {}

async function callGeminiModel<T>(model: string, system: string, content: Block[], tool: Tool, fetcher: typeof fetch): Promise<AiResult<T>> {
  const key = process.env.GEMINI_API_KEY!;
  const parts = [
    ...content.map((b) => (b.type === "text" ? { text: b.text } : { inline_data: { mime_type: b.source.media_type, data: b.source.data } })),
    { text: `Answer only with the JSON for "${tool.name}": ${tool.description}` },
  ];
  const res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      // Room for the model's own thinking as well as the answer.
      generationConfig: { responseMimeType: "application/json", responseSchema: toGeminiSchema(tool.input_schema), maxOutputTokens: 8192, temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(GEMINI_TRY_MS),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    // 404: model retired; 429: this model's quota used up; 500/503: overloaded. Another model may answer.
    if (res.status === 404 || res.status === 429 || res.status === 500 || res.status === 503) throw new GeminiBusyError(`Gemini ${model} ${res.status}: ${body}`);
    // 400 "API key not valid", 401/403: bad key or billing.
    if (res.status === 401 || res.status === 403 || /API key not valid|API_KEY_INVALID|quota|billing/i.test(body)) throw new AiUnavailableError(`Gemini ${res.status}: ${body}`);
    throw new Error(`Gemini ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  if (!text) throw new Error(`Gemini gave no answer (${json.candidates?.[0]?.finishReason ?? "no candidate"})`);
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini's answer was not valid JSON");
  }
  const u = json.usageMetadata ?? {};
  const tokens = { in: u.promptTokenCount ?? 0, out: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
  const costUsd = tokens.in * PRICES.gemini.in + tokens.out * PRICES.gemini.out;
  return { data, costUsd, tokens };
}

const SYSTEM =
  "You help a logo design contest site in Bangladesh check logos before a client picks a winner. " +
  "Be careful and factual. Never claim a logo is legally safe, copyright free or guaranteed. " +
  "Write short, plain English that a small business owner understands.";

// ---- 1. Reading the logo -----------------------------------------------------------------------------

export type Reading = {
  is_logo: boolean;
  /** Owner, 2026-10-16: the logo is shown on a mockup or photo; the check then looks only at `logo_box`. */
  is_mockup?: boolean;
  /** Where the logo is: [ymin, xmin, ymax, xmax] on a 0-1000 scale. */
  logo_box?: number[];
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
    [
      imageBlock(logo),
      textBlock(
        "Read this logo. Describe only what you can see. The picture may show the logo on a mockup (a sign, card, shirt, wall, product or photo): " +
          "then read the logo itself, not the scene, and give the box around the logo (its symbol and name together).",
      ),
    ],
    {
      name: "logo_reading",
      description: "What the logo shows.",
      input_schema: {
        type: "object",
        properties: {
          is_logo: { type: "boolean", description: "True when there is a logo in the image, also when it is shown on a mockup. False only when there is no logo at all (a plain photo, a screenshot, empty)." },
          is_mockup: { type: "boolean", description: "True when the logo is shown on a mockup or in a photo or scene, not on a plain background." },
          logo_box: {
            type: "array",
            items: { type: "integer", minimum: 0, maximum: 1000 },
            minItems: 4,
            maxItems: 4,
            description: "The box around the whole logo (symbol and name): [ymin, xmin, ymax, xmax] on a 0-1000 scale of the image. [0, 0, 1000, 1000] when the logo fills the image.",
          },
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
        required: ["is_logo", "is_mockup", "logo_box", "shape", "logo_type", "text", "colors", "font_look", "font_guess", "description", "tags", "legibility", "colour"],
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
  return { data: r.data.matches ?? [], costUsd: r.costUsd, tokens: r.tokens };
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
