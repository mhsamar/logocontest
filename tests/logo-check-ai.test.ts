import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { aiConfigured, readLogo, summarize, toGeminiSchema, AiUnavailableError, BUSY_WAITS_MS } = await import("@/lib/logo-check/ai");

const PNG = new Uint8Array([137, 80, 78, 71]);
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("copyright checker AI: Google AI Studio (Gemini) or Claude (owner, 2026-10-12)", () => {
  it("is set up with either key, and prefers Gemini", () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(aiConfigured()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "a";
    expect(aiConfigured()).toBe(true);
    process.env.GEMINI_API_KEY = "g";
    expect(aiConfigured()).toBe(true);
  });

  it("turns the tool schema into Gemini's form", () => {
    const s = toGeminiSchema({
      type: "object",
      properties: { colors: { type: "array", items: { type: "string", pattern: "^#" }, maxItems: 6 }, score: { type: "integer", minimum: 0, maximum: 100 } },
      required: ["colors"],
    });
    expect(s).toEqual({
      type: "OBJECT",
      properties: { colors: { type: "ARRAY", items: { type: "STRING" }, maxItems: 6 }, score: { type: "INTEGER", minimum: 0, maximum: 100 } },
      required: ["colors"],
    });
  });

  it("asks Gemini for JSON with the image, and reads its answer", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.LOGO_CHECK_MODEL;
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toContain("/models/gemini-3.5-flash:generateContent");
      expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
      const body = JSON.parse(String(init?.body));
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.generationConfig.responseSchema.type).toBe("OBJECT");
      // Reading a logo sends the picture; the summary is text only.
      if (JSON.stringify(body).includes("Read this logo")) expect(body.contents[0].parts.some((p: { inline_data?: { mime_type: string } }) => p.inline_data?.mime_type === "image/png")).toBe(true);
      const answer = { uniqueness_line: "u", overall_line: "o", advice: "a" };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100 } }), { status: 200 });
    });
    const r = await summarize("facts", fetcher as unknown as typeof fetch);
    expect(r.data).toEqual({ uniqueness_line: "u", overall_line: "o", advice: "a" });
    expect(r.costUsd).toBeGreaterThan(0);
    await readLogo(PNG, fetcher as unknown as typeof fetch).catch(() => {});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("treats a bad key or used-up quota as 'AI not available'", async () => {
    process.env.GEMINI_API_KEY = "bad";
    const fetcher = vi.fn(async () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 }));
    await expect(summarize("x", fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetcher).toHaveBeenCalledTimes(1); // a bad key is bad on every model
    const quota = vi.fn(async () => new Response("quota", { status: 429 }));
    BUSY_WAITS_MS.splice(0, BUSY_WAITS_MS.length, 0, 0);
    await expect(summarize("x", quota as unknown as typeof fetch)).rejects.toBeInstanceOf(AiUnavailableError);
    // Both models, asked three times (owner, 2026-10-16: wait and ask again when all are busy).
    expect(quota).toHaveBeenCalledTimes(6);
  });

  it("asks again after a short wait when every model is busy, instead of failing the check", async () => {
    process.env.GEMINI_API_KEY = "k";
    delete process.env.LOGO_CHECK_MODEL;
    BUSY_WAITS_MS.splice(0, BUSY_WAITS_MS.length, 0, 0);
    const answer = { uniqueness_line: "u", overall_line: "o", advice: "a" };
    let calls = 0;
    const fetcher = vi.fn(async () =>
      ++calls <= 2 ? new Response('{"error":{"message":"high demand"}}', { status: 503 }) : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 }),
    );
    const r = await summarize("facts", fetcher as unknown as typeof fetch);
    expect(r.data).toEqual(answer);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("tries the next model when one is busy or gone", async () => {
    process.env.GEMINI_API_KEY = "k";
    delete process.env.LOGO_CHECK_MODEL;
    const answer = { uniqueness_line: "u", overall_line: "o", advice: "a" };
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/gemini-3.5-flash:")
        ? new Response('{"error":{"message":"high demand"}}', { status: 503 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }), { status: 200 }),
    );
    const r = await summarize("facts", fetcher as unknown as typeof fetch);
    expect(r.data).toEqual(answer);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toContain("/gemini-flash-lite-latest:");
  });
});
