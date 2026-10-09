"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * P-04 (owner, 2026-10-08): every mockup of one design, large, with arrows,
 * swipe, keyboard and thumbnails; the design's details and comments beside it.
 */
export function EntryViewer({
  number,
  images,
  closeHref,
  byline,
  children,
}: {
  number: number;
  images: string[];
  closeHref: string;
  byline: React.ReactNode;
  /** Story and comment box, rendered on the server. */
  children: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const fmt = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);
  const go = (d: number) => setI((x) => (images.length ? (x + d + images.length) % images.length : 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && ["TEXTAREA", "INPUT"].includes(e.target.tagName);
      // A dialog on top (e.g. Report) handles its own Escape.
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
      else if (!typing && e.key === "ArrowRight") setI((x) => (x + 1) % Math.max(1, images.length));
      else if (!typing && e.key === "ArrowLeft") setI((x) => (x - 1 + images.length) % Math.max(1, images.length));
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [closeHref, images.length, router]);

  const arrow = (dir: -1 | 1) => (
    <button
      type="button"
      onClick={() => go(dir)}
      aria-label={dir < 0 ? t("entry.prev") : t("entry.next")}
      className={cx(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-raised transition hover:bg-white",
        dir < 0 ? "left-3" : "right-3",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/80 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={t("entry.title", { n: fmt(number) })}>
      <Link href={closeHref} scroll={false} className="absolute inset-0 cursor-default" aria-hidden tabIndex={-1} />
      <div className="relative flex w-full max-w-6xl flex-col overflow-hidden bg-surface shadow-panel sm:rounded-2xl lg:flex-row">
        {/* Images */}
        <div className="flex min-h-0 flex-col bg-canvas lg:flex-1">
          <div
            className="relative flex flex-1 items-center justify-center p-3 sm:p-5"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touch.current === null) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              touch.current = null;
            }}
          >
            {images[i] && <img src={images[i]} alt={t("submit.mockups.image", { n: i + 1 })} className="aspect-square max-h-[52vh] w-auto max-w-full rounded-lg object-contain shadow-card lg:max-h-[72vh]" />}
            {images.length > 1 && (
              <>
                {arrow(-1)}
                {arrow(1)}
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/75 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white">
                  {t("entry.counter", { i: fmt(i + 1), n: fmt(images.length) })}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <ul className="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-5 sm:pb-5">
              {images.map((src, j) => (
                <li key={src} className="shrink-0">
                  <button type="button" onClick={() => setI(j)} aria-label={t("submit.mockups.image", { n: j + 1 })} aria-current={i === j} className={cx("block size-14 overflow-hidden rounded-md ring-2 transition sm:size-16", i === j ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100")}>
                    <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details and comments */}
        <aside className="flex min-h-0 flex-1 flex-col border-t border-line lg:w-[24rem] lg:flex-none lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink">{t("entry.title", { n: fmt(number) })}</h2>
              <div className="mt-0.5 text-sm text-muted">{byline}</div>
            </div>
            <Link href={closeHref} scroll={false} aria-label={t("entry.close")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </aside>
      </div>
    </div>
  );
}
