"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import type { LiveDesigners } from "@/lib/home/live-designers";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";

const REFRESH_MS = 60_000;

/**
 * The live designers tag above the hero headline (owner, 2026-10-11): three faces, a pulsing green dot,
 * "N designers online now", a divider and "M designers joined". Real numbers from /api/live-designers, refreshed about
 * once a minute while the page is visible. Hidden while there are too few designers (Admin → Settings).
 */
export function LiveDesignersTag({ initial }: { initial: LiveDesigners | null }) {
  const { t, locale } = useI18n();
  const [live, setLive] = useState(initial);

  useEffect(() => {
    let last = Date.now();
    const load = () => {
      last = Date.now();
      fetch("/api/live-designers")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: LiveDesigners | null) => setLive(d))
        .catch(() => {});
    };
    const id = setInterval(() => document.visibilityState === "visible" && load(), REFRESH_MS);
    const onShow = () => document.visibilityState === "visible" && Date.now() - last >= REFRESH_MS && load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  if (!live) return null;
  const n = (v: number) => formatNumber(v, locale);

  return (
    <p
      aria-label={t("home.live.label")}
      className="lc-live m-0 inline-flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-[22px] border border-[#E6E7EB] bg-white px-3 py-1.5 text-[15px] text-[var(--lc-muted)] shadow-[0_6px_18px_rgba(17,18,22,.07)] max-[940px]:mx-auto"
    >
      {live.faces.length > 0 && (
        <span aria-hidden className="flex flex-none">
          {live.faces.map((f, i) =>
            "src" in f ? (
              <img key={i} src={f.src} alt="" width={30} height={30} className="-ml-2 size-[30px] rounded-full object-cover ring-2 ring-white first:ml-0" />
            ) : (
              <span key={i} className="-ml-2 flex size-[30px] items-center justify-center rounded-full bg-[#F3E2E1] text-[11.5px] font-bold text-[#8B0000] ring-2 ring-white first:ml-0">
                {f.initials}
              </span>
            ),
          )}
        </span>
      )}
      {live.online !== null && (
        <>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="lc-live-dot relative size-2 flex-none rounded-full bg-[#1F9D55]" />
            <span>
              <strong className="font-bold text-[var(--lc-ink,#111216)]">{n(live.online)}</strong> {t(live.online === 1 ? "home.live.onlineOne" : "home.live.online")}
            </span>
          </span>
          <span aria-hidden className="h-4 w-px flex-none bg-[#DCDEE3] max-[520px]:hidden" />
        </>
      )}
      <span>
        <strong className="font-bold text-[var(--lc-ink,#111216)]">{n(live.joined)}</strong> {t(live.joined === 1 ? "home.live.joinedOne" : "home.live.joined")}
      </span>
    </p>
  );
}
