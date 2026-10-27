"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refreshes the page's server data every few seconds while someone is looking at it (A-19, A-24): the tab visible and
 * its window in front (owner, 2026-10-27: a page left open on a second screen downloaded everything again around the
 * clock). Coming back to the window refreshes at once when a refresh was skipped.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    let missed = false;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return void (missed = true);
      missed = false;
      router.refresh();
    }, seconds * 1000);
    const back = () => {
      if (!missed || document.visibilityState !== "visible") return;
      missed = false;
      router.refresh();
    };
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
    };
  }, [router, seconds]);
  return null;
}
