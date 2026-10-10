"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { landingBody, landingHeading } from "./fonts";

/**
 * Phone menu for the home page nav (owner, 2026-10-10): the design only shows the button, so this
 * opens a drawer with the nav links and whatever the nav passes in (account, language).
 */
export function HomeNavDrawer({ links, openLabel, closeLabel, children }: { links: { href: string; label: string }[]; openLabel: string; closeLabel: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const path = usePathname();
  const [shownFor, setShownFor] = useState(path);
  if (shownFor !== path) {
    setShownFor(path);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = before;
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="lc-mb h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--lc-line)] bg-white text-[var(--lc-ink)]"
        aria-label={openLabel}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {/* Rendered on <body>: the nav's blur would otherwise trap a fixed panel inside it. */}
      {open &&
        createPortal(
        <div className={cx("lc-landing-drawer fixed inset-0 z-[60]", landingHeading.variable, landingBody.variable)} role="dialog" aria-modal="true" aria-label={openLabel}>
          <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-[#111216]/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div ref={panel} className="absolute inset-y-2 right-2 flex w-[min(20rem,calc(100%-1rem))] flex-col gap-1 overflow-y-auto rounded-[24px] bg-white p-4 shadow-[0_16px_40px_rgba(17,18,22,.18)]">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setOpen(false)} aria-label={closeLabel} className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--lc-line)]">
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-[14px] px-3 text-lg font-semibold hover:bg-[var(--lc-chip)]">
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--lc-line-soft)] pt-4">{children}</div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
