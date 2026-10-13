"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Tells the funnel (Admin › Pro plan) about a Pro step. Fire and forget; never blocks the click. */
export function proEvent(event: "card_seen" | "upgrade_clicked" | "checkout_closed", step?: string) {
  try {
    const body = JSON.stringify({ event, step });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/pro/event", new Blob([body], { type: "application/json" }));
    else void fetch("/api/pro/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* the funnel is best effort */
  }
}

/** "Upgrade to Pro": counts the click, then opens checkout (or the login page for visitors). */
export function UpgradeLink({ href, step, className, children }: { href: string; step: string; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => proEvent("upgrade_clicked", step)}>
      {children}
    </Link>
  );
}
