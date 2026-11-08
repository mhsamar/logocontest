"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/** The client's pictures as thumbnails; a tap opens one full size (owner, 2026-11-08: "lightbox"). */
export function PhotoStrip({ photos, size = "lg" }: { photos: { url: string; name: string }[]; size?: "md" | "lg" }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!photos.length) return null;
  const shown = open === null ? null : photos[open];
  return (
    <>
      <div className="b3-thumbs">
        {photos.map((p, i) => (
          <button key={p.url} type="button" className="b3-thumb-btn" onClick={() => setOpen(i)} aria-label={t("briefV3.view.openPhoto", { n: i + 1 })}>
            <span className={cx("b3-thumb", size)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from storage */}
              <img src={p.url} alt={p.name} loading="lazy" />
            </span>
          </button>
        ))}
      </div>
      {shown && (
        <div className="b3-lightbox" role="dialog" aria-modal="true" aria-label={shown.name} onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link from storage */}
          <img src={shown.url} alt={shown.name} onClick={(e) => e.stopPropagation()} />
          <button type="button" onClick={() => setOpen(null)} autoFocus>
            {t("briefV3.view.closePhoto")}
          </button>
        </div>
      )}
    </>
  );
}
