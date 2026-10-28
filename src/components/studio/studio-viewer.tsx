"use client";

/* eslint-disable @next/next/no-img-element -- signed, short-lived storage links */
import Link from "@/components/ui/link";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { timeAgo } from "@/lib/dates";
import { ShareButtons } from "@/components/share/share-buttons";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { designPath, designPinPath } from "@/lib/share/links";
import { STUDIO_NEW_MS } from "@/lib/studio/options";
import type { StudioDesign } from "@/lib/studio/queries";
import { Chevron, StudioAvatar, StudioBadge } from "./studio-bits";

/**
 * Full preview (owner, 2026-10-12; Design/design-studio): the file large on a dotted stage with ‹ › (wrapping), all
 * files as thumbnails, the facts and "View the contest". Previous/Next design move through the list on the page.
 * Close with ✕, a click on the dark background or Esc; ← → change the file; Tab stays inside while it is open.
 * No download buttons and no link to the designer's profile (owner's decisions).
 */
export function StudioViewer({
  design: d,
  file,
  now,
  canStep,
  onFile,
  onPrev,
  onNext,
  onClose,
}: {
  design: StudioDesign;
  file: number;
  now: Date;
  canStep: boolean;
  onFile: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const n = d.files.length;
  const cur = Math.min(Math.max(0, file), Math.max(0, n - 1));
  const who = d.designer?.username ? `@${d.designer.username}` : t("studio.hiddenDesigner");
  const when = timeAgo(new Date(d.createdAt), now, locale);
  const isNew = !d.isWinner && now.getTime() - Date.parse(d.createdAt) < STUDIO_NEW_MS;
  const label = (i: number) => d.files[i]?.label ?? t("studio.fileN", { n: formatNumber(i + 1, locale) });

  // Keyboard: Esc closes, ← → change the file, Tab stays inside. The page behind doesn't scroll.
  const latest = useRef({ cur, n, onFile, onClose });
  useEffect(() => {
    latest.current = { cur, n, onFile, onClose };
  });
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const { cur: c, n: total, onFile: go, onClose: close } = latest.current;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight" && total > 1) {
        e.preventDefault();
        go((c + 1) % total);
      } else if (e.key === "ArrowLeft" && total > 1) {
        e.preventDefault();
        go((c - 1 + total) % total);
      } else if (e.key === "Tab" && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = before;
    };
  }, []);

  // Rendered on <body>: the page's entrance animation would otherwise move a fixed layer for a moment.
  return createPortal(
    <div className="ds-lbx" role="dialog" aria-modal="true" aria-label={t("studio.viewer.label", { brand: d.brandName })}>
      <div className="ds-lbg" onClick={onClose} aria-hidden />
      <div ref={box} className="ds-lbw">
        <div className="ds-ltop">
          <div className="flex min-w-0 items-center gap-3">
            <StudioAvatar username={d.designer?.username ?? null} url={d.designer?.avatarUrl ?? null} size={40} />
            <div className="flex min-w-0 flex-col">
              <strong className="truncate text-lg">{d.brandName}</strong>
              <span className="truncate text-sm text-[#5F626B]">{t("studio.viewer.by", { who, when })}</span>
            </div>
            <StudioBadge winner={d.isWinner} isNew={isNew} labels={{ winner: t("studio.winner"), new: t("studio.newBadge") }} still />
          </div>
          <div className="flex flex-none items-center gap-2">
            <button type="button" className="ds-lnav" onClick={onPrev} disabled={!canStep} aria-label={t("studio.viewer.prev")}>
              <Chevron dir="left" />
              <span>{t("studio.viewer.prev")}</span>
            </button>
            <button type="button" className="ds-lnav" onClick={onNext} disabled={!canStep} aria-label={t("studio.viewer.next")}>
              <span>{t("studio.viewer.next")}</span>
              <Chevron dir="right" />
            </button>
            <button ref={closeBtn} type="button" className="ds-lx" onClick={onClose} aria-label={t("studio.viewer.close")}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="ds-lbody">
          <div className="ds-lstage">
            <div className="ds-lsq">
              {n === 0 ? (
                <span className="ds-empty-file">#{formatNumber(d.number, locale)}</span>
              ) : (
                d.files.map((f, i) => (
                  <span key={f.url} className="ds-bf" data-on={i === cur ? "" : undefined}>
                    <img src={f.url} alt={i === cur ? `${d.brandName} · ${label(i)}` : ""} decoding="async" />
                  </span>
                ))
              )}
              {n > 1 && (
                <>
                  <button type="button" className="ds-lar ds-lp" onClick={() => onFile((cur - 1 + n) % n)} aria-label={t("studio.viewer.prevFile")}>
                    <Chevron dir="left" />
                  </button>
                  <button type="button" className="ds-lar ds-ln" onClick={() => onFile((cur + 1) % n)} aria-label={t("studio.viewer.nextFile")}>
                    <Chevron dir="right" />
                  </button>
                </>
              )}
            </div>
          </div>

          <aside className="ds-linfo">
            {n > 0 && (
              <p className="ds-lcap m-0" aria-live="polite">
                <b>{t("studio.fileOf", { n: formatNumber(cur + 1, locale), total: formatNumber(n, locale) })}</b>
                {d.files[cur]?.label ? ` · ${d.files[cur].label}` : ""}
              </p>
            )}
            {n > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#5F626B]">{t("studio.viewer.allFiles", { n: formatNumber(n, locale) })}</span>
                <div className="ds-lstrip">
                  {d.files.map((f, i) => (
                    <button key={f.url} type="button" className="ds-lt" onClick={() => onFile(i)} aria-current={i === cur ? "true" : undefined} aria-label={t("studio.viewer.showFile", { n: formatNumber(i + 1, locale) })} title={label(i)}>
                      <img src={f.url} alt="" loading="lazy" decoding="async" />
                      <span>{formatNumber(i + 1, locale)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <dl className="ds-lfacts">
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>{t("studio.viewer.contest")}</dt>
                <dd>{d.brandName}</dd>
              </div>
              <div>
                <dt>{t("studio.viewer.designer")}</dt>
                <dd>{who}</dd>
              </div>
              <div>
                <dt>{t("studio.viewer.sent")}</dt>
                <dd>{when}</dd>
              </div>
            </dl>
            {/* Share it (owner, 2026-10-18): the Studio lists public designs only. */}
            <div data-entry-share>
              <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#5F626B]">{t("share.design")}</span>
              <ShareButtons
                className="mt-1.5"
                url={`${window.location.origin}${designPath(d.contestSlug, d.number)}`}
                media={`${window.location.origin}${designPinPath(d.contestSlug, d.number)}`}
                text={t(d.isWinner ? "share.winnerText" : "share.designText", { n: formatNumber(d.number, locale), brand: d.brandName })}
              />
            </div>
            <Link href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`} className="ds-b1 mt-auto min-h-12">
              {t("studio.viewer.view")}
              <Chevron dir="right" />
            </Link>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
