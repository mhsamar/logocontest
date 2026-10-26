"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { embedUrl, PLAYER_ORIGIN, type HowVideo } from "@/lib/home/how-video";

type Texts = { kicker: string; title: string; body: string; sound: string; play: string; player: string };

/** Asks the video player (YouTube or Vimeo) to do something, without loading either site's script. */
export function playerCommand(frame: HTMLIFrameElement | null, video: HowVideo, action: "play" | "pause" | "unmute" | "mute") {
  const win = frame?.contentWindow;
  if (!win || (video.kind !== "youtube" && video.kind !== "vimeo")) return;
  const origin = PLAYER_ORIGIN[video.kind];
  if (video.kind === "youtube") {
    const send = (func: string, args: unknown[] = []) => win.postMessage(JSON.stringify({ event: "command", func, args }), origin);
    if (action === "unmute") {
      send("unMute");
      send("setVolume", [100]);
    } else if (action === "mute") send("mute");
    else send(action === "play" ? "playVideo" : "pauseVideo");
  } else {
    const send = (method: string, value?: unknown) => win.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), origin);
    if (action === "unmute") {
      send("setMuted", false);
      send("setVolume", 1);
    } else if (action === "mute") send("setMuted", true);
    else send(action);
  }
}

/**
 * The How it works tutorial video (owner, 2026-10-11; Design/how-it-works). Nothing is loaded until the player is at
 * least half on screen. Then it starts muted (browsers only auto-play muted videos) with a "Tap for sound" button,
 * pauses when it scrolls away or the browser tab is hidden, and plays again when it comes back. With the admin switch
 * off, "reduce motion" or data saver, the cover shows with a Play button instead. The 16:9 box is always reserved.
 */
export function HowVideoPlayer({ video, cover, autoplay, texts }: { video: HowVideo; cover: string | null; autoplay: boolean; texts: Texts }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  // "auto": started by itself, muted; "user": the visitor pressed Play, with sound.
  const [started, setStarted] = useState<null | "auto" | "user">(null);
  const [muted, setMuted] = useState(true);
  const inView = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mayAuto = autoplay && !calm && !saveData;

    const io = new IntersectionObserver(
      ([e]) => {
        inView.current = e.intersectionRatio >= 0.5;
        if (inView.current) {
          if (mayAuto) setStarted((s) => s ?? "auto");
          playerCommand(frame.current, video, "play");
        } else playerCommand(frame.current, video, "pause");
      },
      { threshold: [0, 0.5] },
    );
    io.observe(el);
    const onTab = () => {
      if (document.visibilityState === "hidden") playerCommand(frame.current, video, "pause");
      else if (inView.current) playerCommand(frame.current, video, "play");
    };
    document.addEventListener("visibilitychange", onTab);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onTab);
    };
  }, [autoplay, video]);

  const src = started ? embedUrl(video, { autoplay: true, muted: started === "auto" }) : null;

  return (
    <div ref={box} className="relative aspect-video overflow-hidden rounded-[22px] bg-[#15090A] text-white">
      {src ? (
        <>
          <iframe
            ref={frame}
            src={src}
            title={texts.player}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full border-0"
            // The player ignores commands until it is ready: say again whether it should play, in case it scrolled away meanwhile.
            onLoad={() => [1200, 3000].forEach((ms) => setTimeout(() => playerCommand(frame.current, video, inView.current && document.visibilityState === "visible" ? "play" : "pause"), ms))}
          />
          {started === "auto" && muted && (
            <button
              type="button"
              onClick={() => {
                playerCommand(frame.current, video, "unmute");
                playerCommand(frame.current, video, "play");
                setMuted(false);
              }}
              className="absolute bottom-[14%] left-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-bold text-[#111216] shadow-[0_8px_20px_rgba(0,0,0,.35)] sm:left-6"
            >
              <SoundIcon />
              {texts.sound}
            </button>
          )}
        </>
      ) : (
        <Poster cover={cover} texts={texts} onPlay={() => setStarted("user")} />
      )}
    </div>
  );
}

function Poster({ cover, texts, onPlay }: { cover: string | null; texts: Texts; onPlay: () => void }) {
  return (
    <div className="absolute inset-0 [container-type:inline-size]">
      {cover ? (
        <>
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(21,9,10,.82),rgba(21,9,10,.25))]" />
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: "radial-gradient(70cqw 50cqw at 82% 40%, rgba(179,32,27,.75), rgba(139,0,0,0) 70%), radial-gradient(50cqw 40cqw at 0% 100%, rgba(208,138,30,.28), rgba(208,138,30,0) 70%), #15090A" }}
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:5cqw_5cqw]"
          />
        </>
      )}
      <div className="absolute left-[5cqw] top-1/2 flex w-[62cqw] -translate-y-1/2 flex-col items-start gap-[1.6cqw]">
        <span className="rounded-full bg-white/[0.14] px-[1.5cqw] py-[.5cqw] text-[max(11px,1.5cqw)] font-bold uppercase tracking-[.08em] text-[#FFE27A]">{texts.kicker}</span>
        <strong className="lc-d text-[max(20px,5.4cqw)] font-semibold leading-[1.04] tracking-[-0.04em]">{texts.title}</strong>
        <span className="max-w-[46cqw] text-[max(12px,1.9cqw)] leading-[1.4] text-[#F1D5D3] max-[480px]:hidden">{texts.body}</span>
        <button
          type="button"
          onClick={onPlay}
          className="mt-[.6cqw] inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-[max(16px,2.2cqw)] text-[max(14px,1.9cqw)] font-bold text-[#111216]"
        >
          <svg viewBox="0 0 24 24" className="size-[1.1em]" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
          {texts.play}
        </button>
      </div>
    </div>
  );
}

const SoundIcon = () => (
  <svg viewBox="0 0 24 24" className="size-[1.1em]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 5L6 9H3v6h3l5 4V5z" fill="currentColor" />
    <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
  </svg>
);
