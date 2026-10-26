import { z } from "zod";

/**
 * "How it works" tutorial videos (owner, 2026-10-11): one for clients, one for designers, pasted in admin as a
 * YouTube or Vimeo link. The link is checked and taken apart once, when it is saved, so the public page only ever
 * builds an embed address from a known kind and a checked id. Pure: used on the server and in the browser.
 */

export const HOW_VIDEO_TABS = ["client", "designer"] as const;
export type HowVideoTab = (typeof HOW_VIDEO_TABS)[number];
/** The videos set in Admin → Homepage: the two How it works tabs and the Start a contest corner video (owner, 2026-10-26). */
export const VIDEO_SLOTS = [...HOW_VIDEO_TABS, "start"] as const;
export type VideoSlot = (typeof VIDEO_SLOTS)[number];

export const howVideoSchema = z.union([
  z.object({ url: z.literal(""), kind: z.literal(""), id: z.literal(""), hash: z.literal("") }),
  z.object({ url: z.string().url().max(500), kind: z.literal("youtube"), id: z.string().regex(/^[A-Za-z0-9_-]{11}$/), hash: z.literal("") }),
  z.object({ url: z.string().url().max(500), kind: z.literal("vimeo"), id: z.string().regex(/^\d{4,12}$/), hash: z.string().regex(/^([0-9a-f]{6,20})?$/) }),
]);
export type HowVideo = z.infer<typeof howVideoSchema>;
export const NO_VIDEO: HowVideo = { url: "", kind: "", id: "", hash: "" };

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** A pasted link → the stored video, or null when it isn't a YouTube or Vimeo video link. */
export function parseVideoUrl(input: string): HowVideo | null {
  const raw = input.trim();
  if (!raw || raw.length > 500) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const url = `https://${host}${u.pathname}${u.search}`;

  if (YOUTUBE_HOSTS.includes(host)) {
    let id: string | null = null;
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    return id && YT_ID.test(id) ? { url, kind: "youtube", id, hash: "" } : null;
  }

  if (VIMEO_HOSTS.includes(host)) {
    // vimeo.com/123, vimeo.com/123/abcdef (unlisted), vimeo.com/channels/x/123, player.vimeo.com/video/123?h=abcdef
    const at = parts.findIndex((p) => /^\d{4,12}$/.test(p));
    if (at < 0) return null;
    if (host === "player.vimeo.com" ? parts[0] !== "video" : !["channels", "groups", "album", "showcase"].includes(parts[0] ?? "") && at !== 0) return null;
    const next = parts[at + 1];
    const hash = (u.searchParams.get("h") ?? (next && /^[0-9a-f]{6,20}$/.test(next) ? next : "")).toLowerCase();
    if (hash && !/^[0-9a-f]{6,20}$/.test(hash)) return null;
    return { url, kind: "vimeo", id: parts[at]!, hash };
  }
  return null;
}

/**
 * The embed address for a stored video. `muted` starts it without sound (browsers only auto-play muted videos, unless
 * the visitor has tapped the page). `origin`: this site, so YouTube tells the page whether it plays and is muted.
 */
export function embedUrl(video: HowVideo, opts: { autoplay: boolean; muted: boolean; origin?: string }): string | null {
  if (video.kind === "youtube") {
    const q = new URLSearchParams({ autoplay: opts.autoplay ? "1" : "0", mute: opts.muted ? "1" : "0", playsinline: "1", rel: "0", modestbranding: "1", enablejsapi: "1" });
    if (opts.origin) q.set("origin", opts.origin);
    return `https://www.youtube-nocookie.com/embed/${video.id}?${q}`;
  }
  if (video.kind === "vimeo") {
    const q = new URLSearchParams({ autoplay: opts.autoplay ? "1" : "0", muted: opts.muted ? "1" : "0", playsinline: "1", dnt: "1", title: "0", byline: "0", portrait: "0" });
    if (video.hash) q.set("h", video.hash);
    return `https://player.vimeo.com/video/${video.id}?${q}`;
  }
  return null;
}

/** Where player messages go, so a command only ever reaches the video's own site. */
export const PLAYER_ORIGIN = { youtube: "https://www.youtube-nocookie.com", vimeo: "https://player.vimeo.com" } as const;

/** The tutorial video that floats on Start a contest (owner, 2026-10-26), and whether it may start by itself. */
export type StartVideo = { video: HowVideo; autoplay: boolean };

/**
 * A few seconds after it started with sound, from what the player said: "playing" when it played; "wait" while it has
 * said nothing yet or is still loading (a slow connection gets two more looks); else "muted": the browser refused sound,
 * so it plays muted with Tap for sound instead of standing still.
 */
export function afterSoundTry(s: { played: boolean; heard: boolean; state: number | null; tries: number }): "playing" | "wait" | "muted" {
  if (s.played) return "playing";
  if (s.tries < 2 && (!s.heard || s.state === 3)) return "wait";
  return "muted";
}

/** Its own video, else the How it works video for clients; null when it is switched off or there is no video. */
export function pickStartVideo(s: { on: boolean; start: HowVideo; client: HowVideo; autoplay: boolean }): StartVideo | null {
  if (!s.on) return null;
  const video = s.start.kind ? s.start : s.client;
  return video.kind ? { video, autoplay: s.autoplay } : null;
}
