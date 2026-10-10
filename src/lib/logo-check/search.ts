import "server-only";
import { GoogleLogoScanner } from "@/lib/moderation/logo-scan";
import type { MatchSource } from "./rules";

/**
 * Searching the web for the logo (owner's choice, 2026-10-10): real Google Lens results through SearchAPI.io,
 * plus Google Cloud Vision Web Detection for exact copies. Each source runs only when its key is set, and the
 * result says which ones really ran.
 */

export type Candidate = {
  foundBy: MatchSource;
  /** Where to read the image: full image first, then a smaller one. */
  imageUrls: string[];
  pageUrl: string | null;
  title: string | null;
  site: string | null;
  /** A design on logocontest.bd. */
  entryId?: string;
};

export type SourceRun = { ran: boolean; found: number; costUsd: number; error?: string };

/** SearchAPI: about $0.004 a search on the $40 / 10,000 plan. */
const LENS_COST = 0.004;
/** Cloud Vision Web Detection: $3.50 per 1,000 after the first 1,000 a month. */
const VISION_COST = 0.0035;

type LensItem = { title?: string; link?: string; source?: string; thumbnail?: string; image?: { link?: string } | string };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Google Lens through SearchAPI.io. `imageUrl` must be a public link (a short signed link to our copy). */
export async function lensSearch(imageUrl: string, fetcher: typeof fetch = fetch): Promise<{ run: SourceRun; candidates: Candidate[] }> {
  const key = process.env.SEARCHAPI_API_KEY;
  if (!key) return { run: { ran: false, found: 0, costUsd: 0 }, candidates: [] };
  const q = new URLSearchParams({ engine: "google_lens", url: imageUrl, search_type: "all" });
  try {
    const res = await fetcher(`https://www.searchapi.io/api/v1/search?${q}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return { run: { ran: false, found: 0, costUsd: 0, error: `SearchAPI ${res.status}` }, candidates: [] };
    const json = (await res.json()) as { visual_matches?: LensItem[]; exact_matches?: LensItem[] };
    const toCandidate = (m: LensItem): Candidate => {
      const full = typeof m.image === "string" ? m.image : m.image?.link;
      return { foundBy: "lens", imageUrls: [str(full), str(m.thumbnail)].filter((u): u is string => !!u), pageUrl: str(m.link), title: str(m.title), site: str(m.source) };
    };
    // Exact matches first: the same image somewhere else matters most.
    const candidates = [...(json.exact_matches ?? []).slice(0, 8), ...(json.visual_matches ?? []).slice(0, 20)].map(toCandidate).filter((c) => c.imageUrls.length > 0);
    return { run: { ran: true, found: candidates.length, costUsd: LENS_COST }, candidates };
  } catch (e) {
    return { run: { ran: false, found: 0, costUsd: 0, error: e instanceof Error ? e.message : String(e) }, candidates: [] };
  }
}

/** Google Cloud Vision Web Detection: copies of the same image and the pages that show them. */
export async function visionSearch(image: Uint8Array): Promise<{ run: SourceRun; candidates: Candidate[] }> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) return { run: { ran: false, found: 0, costUsd: 0 }, candidates: [] };
  try {
    const r = await new GoogleLogoScanner(key).scan(image);
    const page = r.pages[0] ?? null;
    const images = [...r.full, ...r.partial, ...r.similar.slice(0, 6)];
    const candidates: Candidate[] = images.map((i, n) => ({
      foundBy: "vision",
      imageUrls: [i.url],
      // Vision only links pages to exact copies; the first page goes with the first full match.
      pageUrl: n === 0 && r.full.length ? (page?.url ?? null) : null,
      title: n === 0 && r.full.length ? (page?.title ?? null) : null,
      site: null,
    }));
    return { run: { ran: true, found: candidates.length, costUsd: VISION_COST }, candidates };
  } catch (e) {
    return { run: { ran: false, found: 0, costUsd: 0, error: e instanceof Error ? e.message : String(e) }, candidates: [] };
  }
}
