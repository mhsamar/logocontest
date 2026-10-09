"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refreshes the page's server data every few seconds while the tab is visible (A-19, A-24). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => document.visibilityState === "visible" && router.refresh(), seconds * 1000);
    return () => window.clearInterval(id);
  }, [router, seconds]);
  return null;
}
