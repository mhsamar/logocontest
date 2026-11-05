/* eslint-disable @next/next/no-img-element -- the poster is YouTube's picture or a site picture the CDN keeps */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/ui/link";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { clock, heroTrack, MUTED_KEY, shouldAutoMute, type Chapter } from "./hero-video-rules";

/* The bits of the YouTube IFrame Player API used here. */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(v: number): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer; PlayerState: { PLAYING: number; PAUSED: number; ENDED: number } };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
/** The YouTube player API, loaded once, only when asked for. */
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("youtube api"));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const readMuted = () => {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
};
const saveMuted = (muted: boolean) => {
  try {
    localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Private mode: remembered for this visit only.
  }
};

/** The Start a contest button in the hero, counted for the owner's stats (hero_cta_click). */
export function HeroCtaLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => heroTrack("hero_cta_click")}>
      {children}
    </Link>
  );
}

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PLAY = "M8 5v14l11-7z";
const PAUSE = "M8 5v14M16 5v14";
const SOUND_ON = "M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13";
const SOUND_OFF = "M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6";

/**
 * The home hero's explainer video (owner, 2026-11-06): the YouTube video set in Admin → Homepage, played with
 * YouTube's player but only our own controls on top. It shows the poster until the player is ready, so there is
 * never a black box, and loads YouTube only once the page is ready. Browsers play sound only after a tap, so it tries
 * sound first, else plays muted with "Turn on sound" and turns sound on at the visitor's first tap anywhere (unless
 * they muted it themselves; that choice is kept). After one full play with sound it loops muted. Without a video,
 * with the video off, or when it can't load, the poster or the built-in animation shows instead.
 */
export function HeroVideo({ id, on, sound, poster, chapters, demoPrize }: { id: string | null; on: boolean; sound: boolean; poster: string | null; chapters: Chapter[]; demoPrize: string }) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [askSound, setAskSound] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // The visitor's own mute (kept), a full play heard with sound, and whether we paused it for scrolling away.
  const userMuted = useRef(false);
  const heardOnce = useRef(false);
  const heardFrom = useRef<number | null>(null);
  const pausedOffscreen = useRef(false);
  const half = useRef(false);

  const usable = Boolean(id) && on && !failed;

  const unmute = useCallback((byUser: boolean) => {
    const p = player.current;
    if (!p) return;
    p.unMute();
    p.setVolume(100);
    setMuted(false);
    setAskSound(false);
    if (byUser) {
      userMuted.current = false;
      saveMuted(false);
    }
    heardFrom.current = p.getCurrentTime();
    heroTrack("hero_video_unmute");
  }, []);

  const start = useCallback(
    (withSound: boolean) => {
      if (!id || !mount.current || player.current) return;
      setStarted(true);
      loadYouTube()
        .then((YT) => {
          if (!mount.current || player.current) return;
          player.current = new YT.Player(mount.current, {
            videoId: id,
            host: "https://www.youtube-nocookie.com",
            playerVars: { autoplay: 1, mute: 1, playsinline: 1, loop: 1, playlist: id, controls: 0, rel: 0, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 1, cc_lang_pref: "bn", modestbranding: 1, origin: location.origin },
            events: {
              onReady: () => {
                const p = player.current!;
                setReady(true);
                setDuration(p.getDuration());
                p.playVideo();
                if (withSound && !userMuted.current) {
                  p.unMute();
                  p.setVolume(100);
                }
                // Still muted after half a second: the browser said no to sound.
                window.setTimeout(() => {
                  const m = p.isMuted();
                  setMuted(m);
                  if (m && !userMuted.current) setAskSound(true);
                  if (!m) heardFrom.current = p.getCurrentTime();
                }, 500);
              },
              onStateChange: (e: { data: number }) => {
                const isPlaying = e.data === YT.PlayerState.PLAYING;
                setPlaying(isPlaying);
                if (isPlaying) heroTrack("hero_video_play");
              },
              onError: () => setFailed(true),
            },
          });
        })
        .catch(() => setFailed(true));
    },
    [id],
  );

  // Load YouTube once the page is ready, unless the visitor prefers less motion (then on tapping play).
  useEffect(() => {
    if (!usable) return;
    userMuted.current = readMuted();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const go = () => start(sound && !userMuted.current);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    let handle = 0;
    const later = () => (idle ? (handle = idle(go, { timeout: 2500 })) : (handle = window.setTimeout(go, 1200)));
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      window.removeEventListener("load", later);
      window.clearTimeout(handle);
    };
  }, [usable, sound, start]);

  // The visitor's first tap or key anywhere on the page turns the sound on.
  useEffect(() => {
    if (!ready || !askSound || !sound) return;
    const first = () => {
      if (!userMuted.current && player.current?.isMuted()) unmute(false);
    };
    window.addEventListener("pointerdown", first, { once: true, capture: true });
    window.addEventListener("keydown", first, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", first, { capture: true });
      window.removeEventListener("keydown", first, { capture: true });
    };
  }, [ready, askSound, sound, unmute]);

  // While playing: the progress, the chapter, 50% watched, and the loop before YouTube's end screen.
  useEffect(() => {
    if (!ready || !playing) return;
    const tick = window.setInterval(() => {
      const p = player.current;
      if (!p) return;
      const now = p.getCurrentTime();
      const total = p.getDuration() || duration;
      setTime(now);
      if (total && !half.current && now >= total / 2) {
        half.current = true;
        heroTrack("hero_video_50");
      }
      if (total && now > total - 0.5) {
        // One full play heard with sound: from now on it loops muted (the visitor can turn sound on again).
        if (shouldAutoMute({ heardFrom: heardFrom.current, muted: p.isMuted(), alreadyHeard: heardOnce.current })) {
          heardOnce.current = true;
          p.mute();
          setMuted(true);
        }
        heardFrom.current = p.isMuted() ? null : 0;
        p.seekTo(0, true);
        p.playVideo();
      }
    }, 500);
    return () => window.clearInterval(tick);
  }, [ready, playing, duration]);

  // Paused while the hero is scrolled out of view, played again when it is back.
  useEffect(() => {
    if (!ready || !box.current) return;
    const io = new IntersectionObserver(([e]) => {
      const p = player.current;
      if (!p) return;
      if (!e.isIntersecting && p.getPlayerState() === 1) {
        pausedOffscreen.current = true;
        p.pauseVideo();
      } else if (e.isIntersecting && pausedOffscreen.current) {
        pausedOffscreen.current = false;
        p.playVideo();
      }
    }, { threshold: 0.25 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [ready]);

  useEffect(() => () => player.current?.destroy(), []);

  const toggle = () => {
    const p = player.current;
    if (!p) return start(true);
    pausedOffscreen.current = false;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };
  const toggleSound = () => {
    const p = player.current;
    if (!p) return start(true);
    if (muted) unmute(true);
    else {
      p.mute();
      setMuted(true);
      setAskSound(false);
      userMuted.current = true;
      saveMuted(true);
    }
  };
  // A tap on the video: sound first if it is still muted, otherwise play / pause.
  const onShield = () => (muted && !userMuted.current ? unmute(true) : toggle());
  const seek = (at: number) => {
    const p = player.current;
    if (!p) return start(true);
    p.seekTo(at, true);
    p.playVideo();
    setTime(at);
  };

  const current = chapters.reduce((cur, c, i) => (time >= c.at ? i : cur), 0);
  const total = duration || 0;

  return (
    <>
      <div ref={box} className="hv-vid" role={usable ? undefined : "img"} aria-label={t("heroVideo.videoLabel")}>
        {usable ? (
          <>
            <div className="hv-player" aria-hidden={!ready}>
              <div ref={mount} />
            </div>
            {poster && <img src={poster} alt="" className="hv-poster" data-off={ready && playing ? "" : undefined} onError={(e) => (e.currentTarget.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`)} />}
            {ready ? (
              <button type="button" className="hv-shield" aria-label={playing ? t("heroVideo.pause") : t("heroVideo.play")} onClick={onShield} />
            ) : (
              !started && (
                <button type="button" className="hv-bigplay" aria-label={t("heroVideo.play")} onClick={() => start(true)}>
                  <Icon d={PLAY} size={30} />
                </button>
              )
            )}
            {ready && askSound && muted && (
              <button type="button" className="hv-snd" aria-label={t("heroVideo.soundLabel")} onClick={() => unmute(true)}>
                <Icon d={SOUND_OFF} size={18} />
                {t("heroVideo.sound")}
              </button>
            )}
            {ready && (
              <div className="hv-ctl">
                <button type="button" aria-label={playing ? t("heroVideo.pause") : t("heroVideo.play")} onClick={toggle}>
                  <Icon d={playing ? PAUSE : PLAY} />
                </button>
                <time>{clock(time)}</time>
                <span className="hv-track" aria-hidden>
                  <span style={{ width: total ? `${Math.min(100, (time / total) * 100)}%` : "0%" }} />
                </span>
                <time>{clock(total)}</time>
                <button type="button" aria-label={muted ? t("heroVideo.unmute") : t("heroVideo.mute")} onClick={toggleSound}>
                  <Icon d={muted ? SOUND_OFF : SOUND_ON} />
                </button>
              </div>
            )}
          </>
        ) : poster ? (
          // The video switched off (its poster only), or it couldn't load: the poster, and a way to watch on YouTube.
          <>
            <img src={poster} alt="" className="hv-poster" />
            {failed && id && (
              <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="hv-bigplay" aria-label={t("heroVideo.play")}>
                <Icon d={PLAY} size={30} />
              </a>
            )}
          </>
        ) : (
          <Demo prize={demoPrize} />
        )}
      </div>
      {usable && chapters.length > 0 && (
        <ul className="hv-chs" aria-label={t("heroVideo.chapters")}>
          {chapters.map((c, i) => (
            <li key={`${c.at}-${i}`}>
              <button type="button" className="hv-ch" aria-current={ready && i === current ? "true" : undefined} onClick={() => seek(c.at)}>
                <b>{clock(c.at)}</b>
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The design's own animation, while no video is set: designs arrive for a sample contest and one wins. */
function Demo({ prize }: { prize: string }) {
  const { t, locale } = useI18n();
  const n = (v: number) => formatNumber(v, locale);
  const tiles: { text: string; bg: string; fg: string; font: string; win?: boolean; badge?: boolean; ring?: boolean }[] = [
    { text: "R", bg: "#FFFFFF", fg: "#8B0000", font: "700 clamp(18px,2.2vw,30px) Georgia, serif" },
    { text: "rakib's", bg: "#FFF6DC", fg: "#6B4E00", font: "600 clamp(14px,1.7vw,22px) var(--font-lc-heading), sans-serif" },
    { text: "RK", bg: "#111216", fg: "#FFE27A", font: "700 clamp(13px,1.5vw,20px) var(--font-lc-heading), sans-serif", win: true, ring: true },
    { text: "Rk", bg: "#E8F1EA", fg: "#1F5C3A", font: "italic 700 clamp(16px,2vw,26px) Georgia, serif" },
    { text: "KITCHEN", bg: "#E6EEF6", fg: "#1F3A5F", font: "600 clamp(14px,1.7vw,22px) var(--font-lc-heading), sans-serif" },
    { text: "R", bg: "#F3E6E4", fg: "#8B0000", font: "700 clamp(12px,1.4vw,18px) var(--font-lc-heading), sans-serif", badge: true },
    { text: "R·K", bg: "#FFFFFF", fg: "#43306B", font: "700 clamp(15px,1.8vw,24px) Georgia, serif" },
    { text: "rk.", bg: "#FFF1E0", fg: "#9A3412", font: "700 clamp(16px,2vw,26px) var(--font-lc-heading), sans-serif" },
    { text: "RAKIB", bg: "#ECE8F4", fg: "#43306B", font: "600 clamp(13px,1.5vw,20px) var(--font-lc-heading), sans-serif" },
  ];
  return (
    <div className="hv-demo" aria-hidden>
      <div className="hv-lbl">{t("heroVideo.demoContest", { prize })}</div>
      <div className="hv-tg">
        {tiles.map((x, i) => (
          <div key={i} className={x.win ? "hv-tile hv-win" : "hv-tile"} style={{ background: x.bg, color: x.fg, animationDelay: `${i * 0.35}s` }}>
            {x.win && <span className="hv-crown">{t("heroVideo.demoWinner")}</span>}
            <span
              style={{
                font: x.font,
                ...(x.ring ? { display: "flex", alignItems: "center", justifyContent: "center", width: "clamp(26px,3vw,40px)", height: "clamp(26px,3vw,40px)", border: "2.5px solid currentColor", borderRadius: "50%" } : {}),
                ...(x.badge ? { display: "flex", alignItems: "center", justifyContent: "center", width: "clamp(24px,2.8vw,36px)", height: "clamp(24px,2.8vw,36px)", borderRadius: 8, background: "#8B0000", color: "#fff" } : {}),
              }}
            >
              {x.text}
            </span>
            <small>{t("heroVideo.demoDesign", { n: n(i + 1) })}</small>
          </div>
        ))}
        <div className="hv-tile" style={{ border: "1.5px dashed rgba(255,255,255,.35)", color: "#fff", fontWeight: 700, animationDelay: "2.9s" }}>
          {t("heroVideo.demoMore", { n: n(12) })}
        </div>
      </div>
      <div className="hv-cap">
        <span>{t("heroVideo.demo1")}</span>
        <span>{t("heroVideo.demo2")}</span>
        <span>{t("heroVideo.demo3")}</span>
      </div>
    </div>
  );
}
