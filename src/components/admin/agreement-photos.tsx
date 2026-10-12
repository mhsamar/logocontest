"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type Side = "front" | "back";

/**
 * The ID photos on an agreement card (owner, 2026-10-12; Design/agreements): front and back side by side, loaded
 * only when the card is near the screen, through the admin photo route (Agreements "manage", audit log, a link that
 * works for one minute). Clicking opens a full-size viewer on the page: Esc or X closes, arrow keys switch sides.
 */
export function AgreementPhotos({ designerId, name, sides, uploaded }: { designerId: string; name: string; sides: Side[]; uploaded: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Side | null>(null);
  const src = (side: Side, view: "card" | "full" | "tab") => `/admin/agreements/photo/${designerId}/${side}?v=${view}`;
  const label = (side: Side) => t(side === "front" ? "admin.agreements.front" : "admin.agreements.back");

  const step = useCallback(
    (d: 1 | -1) => setOpen((s) => (s && sides.length > 1 ? sides[(sides.indexOf(s) + d + sides.length) % sides.length] : s)),
    [sides],
  );
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, step]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {sides.map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setOpen(side)}
            aria-label={t("admin.agreements.openPhoto", { side: label(side) })}
            className="group relative block aspect-[1.585/1] overflow-hidden rounded-xl border border-[#DCDEE3] bg-[linear-gradient(135deg,#F3F4F6,#E6E8EC)] transition-opacity hover:opacity-90"
          >
            <img src={src(side, "card")} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-full bg-[rgba(17,18,22,.75)] px-[9px] py-0.5 text-xs font-bold text-white">{label(side)}</span>
            <span aria-hidden className="absolute right-2 top-2 flex size-[30px] items-center justify-center rounded-[9px] bg-white/90 text-[#111216]">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="6" />
                <path d="M20 20l-4.5-4.5M11 8.5v5M8.5 11h5" />
              </svg>
            </span>
          </button>
        ))}
      </div>
      {uploaded && <p className="m-0 text-[13px] text-muted">{uploaded}</p>}

      {open && (
        <div role="dialog" aria-modal="true" aria-label={t("admin.agreements.viewer.title", { name })} className="fixed inset-0 z-[100] flex flex-col bg-[rgba(17,18,22,.92)] p-3 sm:p-6" onClick={() => setOpen(null)}>
          <div className="flex items-center justify-between gap-3 text-white" onClick={(e) => e.stopPropagation()}>
            <p className="m-0 min-w-0 truncate font-semibold">
              {t("admin.agreements.viewer.title", { name })} · {label(open)}
            </p>
            <div className="flex flex-none items-center gap-2">
              <a href={src(open, "tab")} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center rounded-[10px] bg-white/10 px-3 text-sm font-bold text-white hover:bg-white/20">
                {t("admin.agreements.viewer.newTab")} ↗
              </a>
              <button type="button" onClick={() => setOpen(null)} aria-label={t("admin.agreements.viewer.close")} className="flex size-10 items-center justify-center rounded-[10px] bg-white/10 text-xl text-white hover:bg-white/20">
                ×
              </button>
            </div>
          </div>
          <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img key={open} src={src(open, "full")} alt={t("admin.agreements.openPhoto", { side: label(open) })} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
          {sides.length > 1 && (
            <div className="mt-3 flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
              {sides.map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={open === side}
                  onClick={() => setOpen(side)}
                  className={open === side ? "min-h-10 rounded-[10px] bg-white px-4 text-sm font-bold text-[#111216]" : "min-h-10 rounded-[10px] bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"}
                >
                  {label(side)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
