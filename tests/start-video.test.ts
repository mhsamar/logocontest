import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { afterSoundTry, embedUrl, NO_VIDEO, parseVideoUrl, pickStartVideo, type HowVideo } from "@/lib/home/how-video";
import { SETTINGS } from "@/lib/settings/registry";

// Owner, 2026-10-26: clients didn't understand how a contest works, so the tutorial video floats in a corner of Start a
// contest, plays muted by itself, and after × stays a small "How it works" button on that device.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ settings: [] as Row[] }));
const who = vi.hoisted(() => ({ admin: null as null | Row }));
const sent = vi.hoisted(() => ({ audits: [] as unknown[][] }));

vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/admin/core", () => ({ adminUser: async (perm: string) => (perm === "content.manage" ? who.admin : null), audit: async (...a: unknown[]) => void sent.audits.push(a) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      let key = "";
      const q = {
        select: () => q,
        eq: (_k: string, v: string) => ((key = v), q),
        maybeSingle: async () => ({ data: db.settings.find((r) => r.key === key) ?? null, error: null }),
        upsert: async (row: Row) => {
          db.settings = [...db.settings.filter((r) => r.key !== row.key), row];
          return { error: null };
        },
      };
      return q;
    },
  }),
}));

const own = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ") as HowVideo;
const client = parseVideoUrl("https://vimeo.com/123456789") as HowVideo;

beforeEach(() => {
  db.settings = [];
  who.admin = { id: "a1" };
  sent.audits = [];
});

describe("Start a contest: the tutorial video in the corner", () => {
  it("plays its own video, else the How it works video for clients; nothing when off or without a video", () => {
    expect(pickStartVideo({ on: true, start: own, client, autoplay: true })).toEqual({ video: own, autoplay: true });
    expect(pickStartVideo({ on: true, start: NO_VIDEO, client, autoplay: false })).toEqual({ video: client, autoplay: false });
    expect(pickStartVideo({ on: false, start: own, client, autoplay: true })).toBeNull();
    expect(pickStartVideo({ on: true, start: NO_VIDEO, client: NO_VIDEO, autoplay: true })).toBeNull();
  });

  it("when the browser refuses sound it plays muted with Tap for sound; a slow start gets two more looks first", () => {
    expect(afterSoundTry({ played: true, heard: true, state: 1, tries: 0 })).toBe("playing");
    // Nothing said yet, or still loading (YouTube state 3): look again, at most twice.
    expect(afterSoundTry({ played: false, heard: false, state: null, tries: 0 })).toBe("wait");
    expect(afterSoundTry({ played: false, heard: true, state: 3, tries: 1 })).toBe("wait");
    expect(afterSoundTry({ played: false, heard: true, state: 3, tries: 2 })).toBe("muted");
    // Ready but never started (unstarted -1 or cued 5): the browser said no to sound.
    expect(afterSoundTry({ played: false, heard: true, state: -1, tries: 0 })).toBe("muted");
    expect(afterSoundTry({ played: false, heard: true, state: 5, tries: 0 })).toBe("muted");
  });

  it("asks YouTube to report to this site only (so the page knows whether it plays with sound)", () => {
    expect(embedUrl(own, { autoplay: true, muted: false, origin: "https://logocontest.bd" })).toContain("origin=https%3A%2F%2Flogocontest.bd");
    expect(embedUrl(own, { autoplay: true, muted: false, origin: "https://logocontest.bd" })).toContain("mute=0");
    expect(embedUrl(own, { autoplay: true, muted: true })).not.toContain("origin=");
  });

  it("is on and plays by itself out of the box, with no video of its own (no SQL needed)", () => {
    expect(SETTINGS["how.start_video_on"].default).toBe(true);
    expect(SETTINGS["how.start_video_autoplay"].default).toBe(true);
    expect(SETTINGS["how.video_start"].default).toEqual(NO_VIDEO);
    for (const k of ["how.video_start", "how.start_video_on", "how.start_video_autoplay"] as const) expect(SETTINGS[k].group).toBe("how");
  });

  it("Admin › Homepage saves its link and switches, with content.manage, in the audit log", async () => {
    const { saveHowVideo, setHowSwitch } = await import("@/lib/home/how-video-actions");
    expect(await saveHowVideo("start", "https://youtu.be/dQw4w9WgXcQ")).toEqual({ ok: true });
    expect(db.settings.find((r) => r.key === "how.video_start")?.value).toEqual(own);
    expect(sent.audits.at(-1)).toEqual(["a1", "update_how_video", "settings", "how.video_start", { from: null, to: own.url }]);
    expect(await saveHowVideo("start", "https://example.com/video")).toEqual({ ok: false, error: "admin.homepage.videos.badUrl" });

    expect(await setHowSwitch("how.start_video_on", false)).toEqual({ ok: true });
    expect(db.settings.find((r) => r.key === "how.start_video_on")?.value).toBe(false);
    expect(sent.audits.at(-1)).toEqual(["a1", "update_settings", "settings", "how.start_video_on", { from: null, to: false }]);
    expect(await setHowSwitch("how.start_video_autoplay", false)).toEqual({ ok: true });
    expect(await setHowSwitch("how.video_autoplay", true)).toEqual({ ok: true });
  });

  it("the switch action only changes this card's three switches, and only for content.manage", async () => {
    const { saveHowVideo, setHowSwitch } = await import("@/lib/home/how-video-actions");
    const before = sent.audits.length;
    expect(await setHowSwitch("fees.service_fee_percent" as "how.video_autoplay", true)).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(await saveHowVideo("hero" as "start", "https://youtu.be/dQw4w9WgXcQ")).toEqual({ ok: false, error: "auth.errors.generic" });
    who.admin = null;
    expect(await setHowSwitch("how.start_video_on", false)).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(await saveHowVideo("start", "")).toEqual({ ok: false, error: "auth.errors.generic" });
    expect(db.settings).toEqual([]);
    expect(sent.audits.length).toBe(before);
  });

  it("is in both wizards: after the content rules (logo), out of the way at Review and pay, gone once Pay is pressed", () => {
    const wizard = read("src/components/wizard/wizard.tsx");
    expect(wizard).toContain("<StartVideoCorner video={props.video ?? null} ready={state.contentOk === true} atPay={step === S.review} hidden={paying} helpShown={helpSpace > 0} above={bar} onSpace={setVideoSpace} />");
    expect(wizard).toContain("{videoSpace > helpSpace && <div aria-hidden style={{ height: videoSpace - helpSpace }} />}");
    const service = read("src/components/services/service-wizard.tsx");
    expect(service).toContain('<StartVideoCorner video={video} ready atPay={step === "pay"} hidden={paying} helpShown={helpSpace > 0} above={bar} onSpace={setVideoSpace} />');
    expect(service).toContain("{videoSpace > helpSpace && <div aria-hidden style={{ height: videoSpace - helpSpace }} />}");
    const flow = read("src/app/start/start-flow.tsx");
    expect(flow.match(/startVideo\(\),/g)?.length).toBe(2);
    expect(flow.match(/video=\{video\}/g)?.length).toBe(2);
    // Only on Start a contest: never on the payment pages or site-wide.
    for (const f of ["src/app/layout.tsx", "src/app/pay/layout.tsx", "src/components/client/client-area.tsx"]) expect(read(f)).not.toContain("StartVideoCorner");
  });

  it("starts with sound after a tap on the page (else muted), never for reduce motion or data saver, and a closed video stays a small button on this device", () => {
    const corner = read("src/components/wizard/start-video.tsx");
    expect(corner).toContain('embedUrl(v, { autoplay: true, muted: started === "auto", origin: window.location.origin })');
    expect(corner).toContain('if (!open || started || !video?.autoplay) return;');
    expect(corner).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
    expect(corner).toContain("connection?.saveData");
    expect(corner).toContain("userActivation?.hasBeenActive ?? true");
    expect(corner).toContain('if (!calm && !saveData) setStarted(tapped ? "sound" : "auto");');
    // The browser refused sound (it never played): muted, with Tap for sound, instead of standing still.
    expect(corner).toContain('if (started === "sound") window.setTimeout(() => check(0), 3500);');
    expect(corner).toContain('playerCommand(frame.current, v, "mute");');
    expect(corner).toContain("const silent = Boolean(src) && (muted ?? started === \"auto\");");
    expect(corner).toContain('const CLOSED_KEY = "lc-start-video";');
    expect(corner).toContain('window.localStorage.setItem(CLOSED_KEY, "1");');
    expect(corner).toContain('setMode(closed ? "small" : "open");');
    // Paused whenever it is out of sight, and it goes on afterwards only if it was playing (never one they paused).
    expect(corner).toContain("if (!open) return stop();");
    expect(corner).toContain("resume.current ||= playing.current;");
    expect(corner).toContain('if (resume.current) playerCommand(frame.current, video.video, "play");');
    expect(corner).toContain('const onTab = () => (document.visibilityState === "hidden" ? stop() : go());');
    // Out of sight on phones while the help card is open; never the bigger size under it.
    expect(corner).toContain("!(phone && helpShown)");
    expect(corner).toContain("const large = big && !helpShown;");
    // Never taller than the screen; its room isn't reset between sizes (no jump); and both cards follow each other's room.
    expect(corner).toContain("max-w-[calc((100dvh-140px)*16/9)]");
    expect(corner).toContain("if (!shown) onSpace(0);");
    expect(corner).toContain("if (above.current?.parentElement) ro?.observe(above.current.parentElement);");
    expect(read("src/components/wizard/help-card.tsx")).toContain("if (above.current?.parentElement) ro?.observe(above.current.parentElement);");
    // A tap on Tap for sound before the player is ready is said again.
    expect(corner).toContain("[0, 800, 2000].forEach((ms) =>");
    // Privacy-friendly players only (youtube-nocookie, Vimeo do-not-track).
    expect(corner).not.toMatch(/youtube\.com\/embed|vimeo\.com\/video/);
  });
});
