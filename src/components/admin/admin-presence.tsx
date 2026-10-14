"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

const BEAT_MS = 60_000;
const EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;

/**
 * Staff only, on every page (owner, 2026-10-14): checks in once a minute with how long since the last click or key,
 * says goodbye when the tab closes, warns a minute before the idle sign-out and then goes to the sign-in page.
 */
export function AdminPresence({ idleMinutes }: { idleMinutes: number }) {
  const { t } = useI18n();
  const last = useRef(0);
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    last.current = Date.now();
    const limit = idleMinutes * 60_000;
    const signedOut = (reason: string) => {
      // A full page load, so nothing of the signed-out page stays in memory.
      window.location.replace(`/admin-login?ended=${encodeURIComponent(reason)}&next=${encodeURIComponent(window.location.pathname)}`);
    };
    let lastBeat = 0;
    const beat = async () => {
      lastBeat = Date.now();
      const idle = Math.floor((Date.now() - last.current) / 1000);
      const res = await fetch("/api/session/heartbeat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idle }), keepalive: true })
        .then((r) => r.json() as Promise<{ state?: string }>)
        .catch(() => null);
      if (res?.state?.startsWith("ended")) signedOut(res.state.split(":")[1] || "idle");
      else if (res?.state === "signed_out") signedOut("signed_out");
    };
    const onActivity = () => {
      last.current = Date.now();
      setWarn(false);
    };
    // The server decides: another admin tab may still be in use.
    const tick = () => {
      const idleFor = Date.now() - last.current;
      if (idleFor >= limit) return void (Date.now() - lastBeat > 30_000 && beat());
      setWarn(idleFor >= limit - 60_000);
    };
    const bye = () => navigator.sendBeacon?.("/api/session/heartbeat", new Blob([JSON.stringify({ bye: true })], { type: "application/json" }));
    void beat();
    const beatTimer = window.setInterval(() => void beat(), BEAT_MS);
    const tickTimer = window.setInterval(tick, 5_000);
    // A tab coming back to the front checks in at once.
    const onVisible = () => document.visibilityState === "visible" && void beat();
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    window.addEventListener("pagehide", bye);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(beatTimer);
      window.clearInterval(tickTimer);
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
      window.removeEventListener("pagehide", bye);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [idleMinutes]);

  if (!warn) return null;
  return (
    <div role="alert" className="fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-[min(92vw,460px)] items-center justify-between gap-3 rounded-[14px] bg-ink px-4 py-3 text-[15px] text-white shadow-lg">
      <span>{t("admin.security.idleWarning")}</span>
      <button type="button" onClick={() => setWarn(false)} className="min-h-11 shrink-0 rounded-[10px] bg-white px-3 font-bold text-ink">
        {t("admin.security.stay")}
      </button>
    </div>
  );
}
