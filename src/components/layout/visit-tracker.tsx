"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { HEARTBEAT_MS } from "@/lib/analytics/rules";

let last = { path: "", at: 0 };

const send = (body: object) => {
  try {
    void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true, credentials: "same-origin" });
  } catch {
    // Tracking must never get in the way.
  }
};

/** Counts page views and keeps "online now" fresh while the tab is visible (BLUEPRINT §13.2 item 3). */
export function VisitTracker() {
  const path = usePathname();

  useEffect(() => {
    // One view per page: React may run this twice (development, fast re-renders).
    const now = Date.now();
    if (last.path === path && now - last.at < 2000) return;
    last = { path, at: now };
    send({ path, referrer: document.referrer });
  }, [path]);

  useEffect(() => {
    const beat = () => document.visibilityState === "visible" && send({ path: location.pathname, beat: true });
    const id = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
