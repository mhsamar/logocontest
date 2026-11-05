/** The home hero video's small rules (owner, 2026-11-06), apart from the player so they are tested. */

export type Chapter = { at: number; label: string };

/** Where the visitor's own mute is kept: muted once, it starts muted next time too. */
export const MUTED_KEY = "lc_video_muted";

/** 75 → "1:15"; 3725 → "1:02:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "1:15" or "75" → 75; null when it isn't a time. For the chapters in admin. */
export function parseClock(text: string): number | null {
  const v = text.trim();
  if (/^\d{1,5}$/.test(v)) return Number(v);
  const m = /^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$/.exec(v);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * At the end of a play: mute from now on when the video was just heard through with sound from the start (the owner's
 * "after the first full play with sound, keep looping muted"). Only once; the visitor can turn sound on again.
 */
export function shouldAutoMute(s: { heardFrom: number | null; muted: boolean; alreadyHeard: boolean }): boolean {
  return !s.alreadyHeard && !s.muted && s.heardFrom !== null && s.heardFrom <= 1;
}

/**
 * Counts a hero video moment once per page view (owner, 2026-11-06): hero_video_play, hero_video_unmute,
 * hero_video_50, hero_cta_click. To the data layer and, where the Meta Pixel runs, as a custom event. Nothing personal.
 */
const sent = new Set<string>();
export function heroTrack(name: "hero_video_play" | "hero_video_unmute" | "hero_video_50" | "hero_cta_click"): void {
  if (typeof window === "undefined" || sent.has(name)) return;
  sent.add(name);
  try {
    const w = window as Window & { dataLayer?: unknown[]; fbq?: (...args: unknown[]) => void };
    (w.dataLayer ??= []).push({ event: name });
    if (typeof w.fbq === "function") w.fbq("trackCustom", name);
  } catch {
    // Counting never gets in the way of the page.
  }
}
