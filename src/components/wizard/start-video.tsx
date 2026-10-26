"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { createPortal } from "react-dom";
import { playerCommand } from "@/components/how/how-video";
import { cx } from "@/lib/cx";
import { afterSoundTry, embedUrl, PLAYER_ORIGIN, type HowVideo, type StartVideo } from "@/lib/home/how-video";
import { useI18n } from "@/lib/i18n/client";

/** Space between the video and the Next / Pay bar. */
const GAP = 8;
/** Closed once: on this device it stays the small "How it works" button and never opens by itself again. */
const CLOSED_KEY = "lc-start-video";
/** The wizards' phone layout (their bar is sticky up to here, and the help card is full width). */
const PHONE = "(max-width: 720px)";

/** Asks the player to tell this page when it plays and whether it is muted (no YouTube or Vimeo script is loaded). */
function listen(frame: HTMLIFrameElement | null, video: HowVideo) {
  const win = frame?.contentWindow;
  if (!win) return;
  if (video.kind === "youtube") win.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), PLAYER_ORIGIN.youtube);
  else if (video.kind === "vimeo") for (const value of ["play", "playProgress", "pause", "ended"]) win.postMessage(JSON.stringify({ method: "addEventListener", value }), PLAYER_ORIGIN.vimeo);
}

const onPhoneChange = (cb: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * The tutorial video in the bottom-left corner of Start a contest (owner, 2026-10-26), in the logo and design-service
 * wizards. It opens once the content rules are agreed (`ready`) and starts by itself with sound (owner, 2026-10-26: not
 * "Tap for sound"). Browsers allow that only after a tap on the page ("I agree" is one); where they still refuse
 * (iPhones, or a page opened with no tap yet) it plays muted with "Tap for sound" instead of standing still. Not with
 * the admin switch off, "reduce motion" or data saver, where it shows a Play button. ⤢ makes it bigger; × pauses it and leaves a small "How it works" button, and on this device
 * it never opens by itself again. Out of the way on the payment step (`atPay`) and once Pay is pressed (`hidden`),
 * and on phones while the team's help card is open (`helpShown`), which takes the bottom of the screen there. Like
 * the help card, it keeps clear of the Next / Pay bar (`above`) and asks for room under the last fields (`onSpace`).
 */
export function StartVideoCorner({ video, ready, atPay, hidden, helpShown, above, onSpace }: { video: StartVideo | null; ready: boolean; atPay: boolean; hidden: boolean; helpShown: boolean; above: RefObject<HTMLElement | null>; onSpace: (px: number) => void }) {
  const { t } = useI18n();
  const phone = useSyncExternalStore(onPhoneChange, () => window.matchMedia(PHONE).matches, () => false);
  // Read from this device after mount: null until then, so nothing is drawn on the server.
  const [mode, setMode] = useState<null | "open" | "small">(null);
  const [big, setBig] = useState(false);
  // "sound": started by itself with sound; "auto": by itself, muted (no tap on the page yet); "user": they pressed Play.
  const [started, setStarted] = useState<null | "sound" | "auto" | "user">(null);
  // Playing without sound, as far as the player said (null: not said yet).
  const [muted, setMuted] = useState<boolean | null>(null);
  const [lift, setLift] = useState(16);
  const win = useRef<HTMLElement>(null);
  const small = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // Whether it is open right now, for the player's late "ready" moment.
  const openNow = useRef(false);
  // What the player said: anything at all, it really played, and its last YouTube state (3: still loading).
  const heard = useRef(false);
  const played = useRef(false);
  const state = useRef<number | null>(null);
  // Playing right now, as far as the player said; and whether it was when the page hid it (then it goes on after).
  const playing = useRef(false);
  const resume = useRef(false);
  // They asked for sound (Tap for sound, or opened it again): said again once the player is ready.
  const wantSound = useRef(false);

  const shown = Boolean(video && ready && mode && !hidden && !atPay && !(phone && helpShown));
  const open = shown && mode === "open";
  // Never the bigger size under the help card (it sits on the right from tablets up).
  const large = big && !helpShown;

  useEffect(() => {
    let closed = false;
    try {
      closed = window.localStorage.getItem(CLOSED_KEY) === "1";
    } catch {
      // Private window: it opens as usual.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    setMode(closed ? "small" : "open");
  }, []);

  // Starts by itself the first time it is open, unless the admin switch, "reduce motion" or data saver says no: with
  // sound once the visitor has tapped the page, else muted.
  useEffect(() => {
    if (!open || started || !video?.autoplay) return;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tapped = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- motion, data saver and taps are only readable in the browser
    if (!calm && !saveData) setStarted(tapped ? "sound" : "auto");
  }, [open, started, video]);

  // What the player says: whether it really plays, and whether it is muted (YouTube reports once asked; Vimeo is asked).
  useEffect(() => {
    if (!video || !started) return;
    const kind = video.video.kind;
    if (kind !== "youtube" && kind !== "vimeo") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== PLAYER_ORIGIN[kind] || e.source !== frame.current?.contentWindow) return;
      let d: { event?: unknown; method?: unknown; value?: unknown; info?: { playerState?: unknown; muted?: unknown } | null } | null = null;
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (!d || typeof d !== "object") return;
      heard.current = true;
      if (kind === "youtube") {
        if (typeof d.info?.playerState === "number") {
          state.current = d.info.playerState;
          playing.current = d.info.playerState === 1 || d.info.playerState === 3;
        }
        if (d.info?.playerState === 1) played.current = true;
        if (typeof d.info?.muted === "boolean") setMuted(d.info.muted);
      } else {
        if (d.event === "play" || d.event === "playProgress") played.current = playing.current = true;
        if (d.event === "pause" || d.event === "ended") playing.current = false;
        if (d.method === "getMuted" && typeof d.value === "boolean") setMuted(d.value);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [video, started]);

  // Paused whenever it is out of sight (closed, payment, help card) or the browser tab is hidden; when it is back it goes
  // on only if it was playing then, never a video they paused or that ended.
  useEffect(() => {
    openNow.current = open;
    if (!video) return;
    const stop = () => {
      resume.current ||= playing.current;
      playerCommand(frame.current, video.video, "pause");
    };
    const go = () => {
      if (resume.current) playerCommand(frame.current, video.video, "play");
      resume.current = false;
    };
    if (!open) return stop();
    go();
    const onTab = () => (document.visibilityState === "hidden" ? stop() : go());
    document.addEventListener("visibilitychange", onTab);
    return () => document.removeEventListener("visibilitychange", onTab);
  }, [open, video]);

  // Never over the Next / Pay button: above the bar when it is on the screen (under it when there is no room above),
  // else low in the corner. Only where the bar and the corner share the screen (on wide screens the form may not
  // reach the corner). Follows scrolling and size changes.
  useEffect(() => {
    if (!shown) return;
    let raf = 0;
    let room = -1;
    const edge = phone ? 12 : 24;
    const place = () => {
      raf = 0;
      const el = mode === "open" ? win.current : small.current;
      if (!el) return;
      const h = el.offsetHeight;
      const me = el.getBoundingClientRect();
      const bar = above.current?.getBoundingClientRect();
      const across = Boolean(bar && bar.left < me.right && bar.right > me.left);
      // Room under the last fields; the bar moves, so place again once the page has made it.
      const need = across ? h + GAP : 0;
      if (need !== room) {
        room = need;
        onSpace(need);
        raf = window.requestAnimationFrame(place);
        return;
      }
      const vh = window.innerHeight;
      let next = edge;
      if (across && bar && bar.bottom > 0 && bar.top < vh) {
        if (bar.top - GAP >= h + GAP) next = vh - bar.top + GAP;
        else if (vh - bar.bottom - GAP >= h + GAP) next = edge;
        else next = Math.min(vh - bar.top + GAP, Math.max(GAP, vh - h - GAP));
      }
      setLift(Math.round(next));
      // A field reached with the keyboard is scrolled clear of the video, never left under it.
      document.documentElement.style.scrollPaddingBottom = across ? `${Math.round(next + h + GAP)}px` : "";
    };
    const soon = () => {
      if (!raf) raf = window.requestAnimationFrame(place);
    };
    soon();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(soon);
    if (above.current) ro?.observe(above.current);
    // The help card's room moves the bar without resizing it: its parent grows.
    if (above.current?.parentElement) ro?.observe(above.current.parentElement);
    const el = mode === "open" ? win.current : small.current;
    if (el) ro?.observe(el);
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      document.documentElement.style.scrollPaddingBottom = "";
    };
  }, [shown, mode, large, phone, above, onSpace]);
  // Its room goes when it is out of sight or gone (not between sizes, so the page doesn't jump).
  useEffect(() => {
    if (!shown) onSpace(0);
  }, [shown, onSpace]);
  useEffect(() => () => onSpace(0), [onSpace]);

  if (!video || !mode || typeof document === "undefined") return null;
  const v = video.video;
  const src = started ? embedUrl(v, { autoplay: true, muted: started === "auto", origin: window.location.origin }) : null;
  // Tap for sound: while it plays muted (said by the player, or started muted).
  const silent = Boolean(src) && (muted ?? started === "auto");

  // Started with sound but the browser refused it (it never played): play it muted, with Tap for sound.
  const check = (tries: number) => {
    if (!openNow.current) return;
    const next = afterSoundTry({ played: played.current, heard: heard.current, state: state.current, tries });
    if (next === "wait") return void window.setTimeout(() => check(tries + 1), 3000);
    if (next === "playing") {
      // Vimeo may have muted it by itself: then Tap for sound shows.
      if (v.kind === "vimeo") frame.current?.contentWindow?.postMessage(JSON.stringify({ method: "getMuted" }), PLAYER_ORIGIN.vimeo);
      return;
    }
    playerCommand(frame.current, v, "mute");
    playerCommand(frame.current, v, "play");
    setMuted(true);
  };
  const loaded = () => {
    [0, 400, 1000, 2000].forEach((ms) => window.setTimeout(() => listen(frame.current, v), ms));
    // The player ignores commands until it is ready: say again whether it should play.
    [1200, 3000].forEach((ms) =>
      window.setTimeout(() => {
        const go = openNow.current && document.visibilityState === "visible";
        if (go && wantSound.current) playerCommand(frame.current, v, "unmute");
        playerCommand(frame.current, v, go ? "play" : "pause");
      }, ms),
    );
    if (started === "sound") window.setTimeout(() => check(0), 3500);
  };

  const close = () => {
    playerCommand(frame.current, v, "pause");
    setMode("small");
    setBig(false);
    try {
      window.localStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // Private window: closed until the page reloads.
    }
    window.requestAnimationFrame(() => small.current?.focus({ preventScroll: true }));
  };
  // Opened again by a tap: with sound.
  const reopen = () => {
    setMode("open");
    if (!started) setStarted("user");
    else {
      wantSound.current = true;
      playerCommand(frame.current, v, "unmute");
      playerCommand(frame.current, v, "play");
      setMuted(false);
    }
    window.requestAnimationFrame(() => win.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }));
  };
  // A tap before the player is ready is said again a moment later.
  const sound = () => {
    wantSound.current = true;
    setMuted(false);
    [0, 800, 2000].forEach((ms) =>
      window.setTimeout(() => {
        playerCommand(frame.current, v, "unmute");
        playerCommand(frame.current, v, "play");
      }, ms),
    );
  };
  // The site's red focus ring is hard to see on the dark window: white there.
  const icon = "flex size-7 flex-none items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-white! min-[721px]:size-8";

  return createPortal(
    <>
      {/* Kept in the page while it is out of sight, so the video stays where it was. */}
      <section
        ref={win}
        aria-label={t("wizard.video.label")}
        style={{ bottom: lift }}
        className={cx(
          "fixed left-3 z-20 overflow-hidden rounded-2xl bg-[#15090A] text-white shadow-raised ring-1 ring-black/10 motion-safe:animate-rise min-[721px]:left-6",
          // Bigger, but never taller than the screen (phones held sideways).
          large ? "w-[calc(100vw-24px)] max-w-[calc((100dvh-140px)*16/9)] min-[721px]:w-[min(560px,calc(100vw-48px))]" : "w-[44vw] max-w-[220px] min-[721px]:w-[300px] min-[721px]:max-w-none [@media(max-height:500px)]:w-[220px]",
          !open && "hidden",
        )}
      >
        <div className="flex items-center gap-0.5 py-0.5 pl-2.5 pr-1 min-[721px]:pl-3">
          {/* Two short lines rather than cut off (Bangla on the narrowest phones). */}
          <span className="line-clamp-2 min-w-0 flex-1 text-[11.5px] font-bold leading-[1.4] min-[721px]:text-[12.5px]">{t("wizard.video.title")}</span>
          {!helpShown && (
            <button type="button" onClick={() => setBig(!big)} aria-label={t(large ? "wizard.video.smaller" : "wizard.video.bigger")} className={icon}>
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {large ? <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /> : <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />}
              </svg>
            </button>
          )}
          <button type="button" onClick={close} aria-label={t("wizard.video.close")} className={icon}>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="relative aspect-video bg-black">
          {src ? (
            <>
              <iframe
                ref={frame}
                src={src}
                title={t("wizard.video.player")}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 size-full border-0"
                onLoad={loaded}
              />
              {silent && (
                <button
                  type="button"
                  onClick={sound}
                  className={cx(
                    "absolute left-1.5 top-1.5 inline-flex items-center rounded-full bg-white font-bold text-[#111216] shadow-[0_6px_16px_rgba(0,0,0,.35)] focus-visible:outline-white!",
                    large ? "min-h-9 gap-1.5 px-3.5 text-[14px]" : "min-h-7 gap-1 px-2.5 text-[11.5px] min-[721px]:min-h-8 min-[721px]:text-[12.5px]",
                  )}
                >
                  <SoundIcon />
                  {t("wizard.video.sound")}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setStarted("user")}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[radial-gradient(80%_70%_at_75%_30%,rgba(179,32,27,.75),rgba(139,0,0,0)_70%),#15090A] text-[13px] font-bold focus-visible:-outline-offset-4! focus-visible:outline-white!"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-white text-[#111216] shadow-[0_8px_20px_rgba(0,0,0,.35)]">
                <PlayIcon className="ml-0.5 size-5" />
              </span>
              {t("wizard.video.play")}
            </button>
          )}
        </div>
      </section>
      {shown && mode === "small" && (
        <button
          ref={small}
          type="button"
          onClick={reopen}
          aria-label={t("wizard.video.open")}
          style={{ bottom: lift }}
          className="fixed left-3 z-20 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#15090A] pl-2 pr-4 text-[14px] font-bold text-white shadow-raised ring-1 ring-black/10 motion-safe:animate-rise min-[721px]:left-6"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-white text-[#111216]">
            <PlayIcon className="ml-0.5 size-3.5" />
          </span>
          {t("wizard.video.title")}
        </button>
      )}
    </>,
    document.body,
  );
}

const PlayIcon = ({ className }: { className: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

const SoundIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[1.1em]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
  </svg>
);
