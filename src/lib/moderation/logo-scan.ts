import "server-only";

/**
 * Logo Scan add-on (BLUEPRINT §7.4, owner 2026-10-08): searches the web for the same
 * or a visually similar image. Drivers: `log` (dev: searches nothing and says so) and
 * `google` (Google Cloud Vision Web Detection, same key as image moderation).
 */

export type ScanImage = { url: string };
export type ScanPage = { url: string; title: string | null };
export type ScanResult = {
  driver: string;
  full: ScanImage[];
  partial: ScanImage[];
  similar: ScanImage[];
  pages: ScanPage[];
};

export interface LogoScanner {
  readonly name: string;
  scan(image: Uint8Array): Promise<ScanResult>;
}

/** Dev driver: no web search. The page says the scan only runs on the live site. */
export class LogLogoScanner implements LogoScanner {
  readonly name = "log";
  async scan(image: Uint8Array): Promise<ScanResult> {
    console.info(`[logo-scan:log] would search the web for an image of ${image.byteLength} bytes`);
    return { driver: this.name, full: [], partial: [], similar: [], pages: [] };
  }
}

type WebDetection = {
  fullMatchingImages?: { url?: string }[];
  partialMatchingImages?: { url?: string }[];
  visuallySimilarImages?: { url?: string }[];
  pagesWithMatchingImages?: { url?: string; pageTitle?: string }[];
};

const images = (list: { url?: string }[] | undefined, max: number): ScanImage[] =>
  (list ?? []).filter((i): i is { url: string } => typeof i.url === "string" && /^https?:\/\//.test(i.url)).slice(0, max).map((i) => ({ url: i.url }));

/** Strips HTML tags Vision sometimes leaves in page titles. */
const cleanTitle = (t: string | undefined) => (t ? t.replace(/<[^>]+>/g, "").trim() || null : null);

export class GoogleLogoScanner implements LogoScanner {
  readonly name = "google";
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async scan(image: Uint8Array): Promise<ScanResult> {
    const res = await this.fetcher(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ image: { content: Buffer.from(image).toString("base64") }, features: [{ type: "WEB_DETECTION", maxResults: 20 }] }],
      }),
    });
    if (!res.ok) throw new Error(`Vision API ${res.status}`);
    const json = (await res.json()) as { responses?: { webDetection?: WebDetection }[] };
    const web = json.responses?.[0]?.webDetection ?? {};
    return {
      driver: this.name,
      full: images(web.fullMatchingImages, 10),
      partial: images(web.partialMatchingImages, 10),
      similar: images(web.visuallySimilarImages, 12),
      pages: (web.pagesWithMatchingImages ?? [])
        .filter((p): p is { url: string; pageTitle?: string } => typeof p.url === "string" && /^https?:\/\//.test(p.url))
        .slice(0, 10)
        .map((p) => ({ url: p.url, title: cleanTitle(p.pageTitle) })),
    };
  }
}

export function getLogoScanner(): LogoScanner {
  const driver = process.env.LOGO_SCAN_DRIVER ?? "log";
  switch (driver) {
    case "log":
      return new LogLogoScanner();
    case "google": {
      const key = process.env.GOOGLE_VISION_API_KEY;
      if (!key) throw new Error("Missing environment variable GOOGLE_VISION_API_KEY. See .env.example.");
      return new GoogleLogoScanner(key);
    }
    default:
      throw new Error(`Unknown LOGO_SCAN_DRIVER "${driver}". Use "log" or "google".`);
  }
}
