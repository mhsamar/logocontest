"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { VoiceCue } from "@/lib/payments/pay-v3";
import { clock } from "@/components/home/landing/hero-video-rules";
import { cueAt, VOICE_MUTED_KEY, voicePlayedKey } from "./rules";

// A quiet moment of sound: playing it on a tap lets the same player speak later without one (iPhone Safari included).
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
let shared: HTMLAudioElement | null = null;
const audioEl = () => (shared ??= Object.assign(new Audio(), { preload: "auto" }));

/**
 * Call on the tap that opens the payment screen (the wizard's Next, owner 2026-11-06): plays and stops a moment of
 * silence on the player the voice guide then uses, so the browser lets it play with sound on the next screen.
 */
export function primeVoice(): void {
  if (typeof window === "undefined") return;
  try {
    const a = audioEl();
    if (a.src && !a.src.startsWith("data:")) return;
    a.src = SILENCE;
    void a.play().then(() => a.pause()).catch(() => {});
  } catch {
    // Never in the way of the button.
  }
}

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Private mode: this visit only.
  }
};

const Svg = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/**
 * The payment screen's voice guide (owner, 2026-11-06): the MP3 from Admin › Payments, played by the page's own audio
 * player. About 0.7 s after the screen opens it plays with sound, once per contest, unless the visitor muted it
 * before; if the browser blocks it, the play button pulses and the first tap anywhere starts it. The line shown and the
 * box lit up follow the timing table, from the audio's own clock. It stops when the screen is left.
 */
export function VoicePlayer({ url, cues, contestId, onBox }: { url: string; cues: VoiceCue[]; contestId: string; onBox: (box: VoiceCue["box"] | null) => void }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const onBoxRef = useRef(onBox);
  useEffect(() => {
    onBoxRef.current = onBox;
  }, [onBox]);

  useEffect(() => {
    const a = audioEl();
    if (a.src !== url) a.src = url;
    a.muted = false;
    const isMuted = get(VOICE_MUTED_KEY) === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    setMuted(isMuted);
    const update = () => {
      setTime(a.currentTime);
      if (Number.isFinite(a.duration)) setDuration(a.duration);
      onBoxRef.current(cueAt(cues, a.currentTime)?.box ?? null);
    };
    const onPlay = () => {
      setPlaying(true);
      setBlocked(false);
      set(voicePlayedKey(contestId), "1");
    };
    const onStop = () => {
      setPlaying(false);
      onBoxRef.current(null);
    };
    a.addEventListener("timeupdate", update);
    a.addEventListener("loadedmetadata", update);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onStop);
    a.addEventListener("ended", onStop);

    // Once per contest, and never after the visitor muted it.
    let first: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      if (isMuted || get(voicePlayedKey(contestId))) return;
      a.play().catch(() => {
        setBlocked(true);
        first = () => {
          if (get(VOICE_MUTED_KEY) !== "1") void a.play().catch(() => {});
        };
        window.addEventListener("pointerdown", first, { once: true, capture: true });
      });
    }, 700);
    return () => {
      window.clearTimeout(timer);
      if (first) window.removeEventListener("pointerdown", first, { capture: true });
      a.removeEventListener("timeupdate", update);
      a.removeEventListener("loadedmetadata", update);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onStop);
      a.removeEventListener("ended", onStop);
      a.pause();
      onBoxRef.current(null);
    };
  }, [url, cues, contestId]);

  const toggle = () => {
    const a = audioEl();
    if (a.paused) {
      if (muted) {
        setMuted(false);
        set(VOICE_MUTED_KEY, "0");
      }
      void a.play().catch(() => setBlocked(true));
    } else a.pause();
  };
  const toggleMute = () => {
    const a = audioEl();
    const next = !muted;
    setMuted(next);
    set(VOICE_MUTED_KEY, next ? "1" : "0");
    if (next) a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioEl();
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration));
    setTime(a.currentTime);
  };
  const line = cueAt(cues, time)?.text ?? cues[0]?.text ?? "";

  return (
    <div className="pv-voice" data-playing={playing ? "" : undefined}>
      <button type="button" className={playing ? "pv-vbtn" : "pv-vbtn pv-pulse"} aria-label={playing ? t("payV3.voice.pause") : t("payV3.voice.play")} onClick={toggle}>
        {playing ? (
          <span className="pv-eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <Svg d="M8 5v14l11-7z" size={20} />
        )}
      </button>
      <div className="pv-vmid">
        <div className="pv-vtop">
          <strong>{blocked && !playing ? t("payV3.voice.listen") : t("payV3.voice.title")}</strong>
          <span>
            {clock(time)} / {clock(duration)}
          </span>
        </div>
        <div className="pv-vbar" onClick={seek} role="presentation">
          <span style={{ width: duration ? `${Math.min(100, (time / duration) * 100)}%` : "0%" }} />
        </div>
        <span className="pv-vline">{line}</span>
      </div>
      <button type="button" className="pv-vmute" aria-label={muted ? t("payV3.voice.unmute") : t("payV3.voice.mute")} aria-pressed={muted} onClick={toggleMute}>
        <Svg d={muted ? "M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6" : "M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7"} />
      </button>
    </div>
  );
}
