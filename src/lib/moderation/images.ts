/**
 * Image moderation (BLUEPRINT §4): nude or sexual photos are refused.
 * Every upload is checked on the server; the browser can't be trusted.
 */
export type ModerationResult = { allowed: true } | { allowed: false; reason: "adult" | "racy" | "error" };

export interface ImageModerator {
  check(image: Uint8Array, mimeType: string): Promise<ModerationResult>;
}

/** Dev driver: allows everything and logs it. */
export class LogImageModerator implements ImageModerator {
  async check(image: Uint8Array, mimeType: string): Promise<ModerationResult> {
    console.info(`[moderation:log] allowed ${mimeType} (${image.byteLength} bytes)`);
    return { allowed: true };
  }
}

export type Likelihood = "UNKNOWN" | "VERY_UNLIKELY" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "VERY_LIKELY";

/** Refuse when adult is LIKELY or more, or racy is VERY_LIKELY (BLUEPRINT §4). */
export function safeSearchVerdict(annotation: { adult?: Likelihood; racy?: Likelihood } | undefined): ModerationResult {
  if (!annotation) return { allowed: false, reason: "error" };
  if (annotation.adult === "LIKELY" || annotation.adult === "VERY_LIKELY") return { allowed: false, reason: "adult" };
  if (annotation.racy === "VERY_LIKELY") return { allowed: false, reason: "racy" };
  return { allowed: true };
}

/** Google Cloud Vision SafeSearch over its REST API. Fails closed: if the check can't run, the photo is refused. */
export class GoogleVisionModerator implements ImageModerator {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async check(image: Uint8Array): Promise<ModerationResult> {
    try {
      const res = await this.fetcher(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(this.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ image: { content: Buffer.from(image).toString("base64") }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
        }),
      });
      if (!res.ok) throw new Error(`Vision API ${res.status}`);
      const json = (await res.json()) as { responses?: { safeSearchAnnotation?: { adult?: Likelihood; racy?: Likelihood } }[] };
      return safeSearchVerdict(json.responses?.[0]?.safeSearchAnnotation);
    } catch (e) {
      console.error("[moderation] check failed:", e instanceof Error ? e.message : e);
      return { allowed: false, reason: "error" };
    }
  }
}

export function getImageModerator(): ImageModerator {
  const driver = process.env.MODERATION_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogImageModerator();
    case "google": {
      const key = process.env.GOOGLE_VISION_API_KEY;
      if (!key) throw new Error("Missing environment variable GOOGLE_VISION_API_KEY. See .env.example.");
      return new GoogleVisionModerator(key);
    }
    default:
      throw new Error(`Unknown MODERATION_DRIVER "${driver}". Use "log" or "google".`);
  }
}
