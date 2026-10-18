"use client";

import { useEffect } from "react";

/** Where a design view came from, by the page before it (for Pro insights). */
function sourceOf(ref: string): string {
  try {
    const u = new URL(ref);
    if (u.host !== window.location.host) return "other";
    const p = u.pathname;
    if (p.startsWith("/contests")) return "browse";
    if (p.startsWith("/design-studio")) return "studio";
    if (p.startsWith("/leaderboard")) return "leaderboard";
    if (p.startsWith("/d/") || p.startsWith("/designer/")) return "profile";
    if (p.startsWith("/contest/")) return "contest";
  } catch {
    /* no referrer */
  }
  return "other";
}

/** Counts one view of a design (owner, 2026-10-13: Pro insights). Fire and forget, once per opened design. */
export function EntryViewBeacon({ entryId }: { entryId: string }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({ entryId, source: sourceOf(document.referrer) });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/pro/view", new Blob([body], { type: "application/json" }));
      else void fetch("/api/pro/view", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {
      /* best effort */
    }
  }, [entryId]);
  return null;
}
