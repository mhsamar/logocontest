"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/**
 * Share profile (owner, 2026-10-12; Design/designer-profile): opens on hover or click. The owner also sees "View
 * public profile" (the page as clients see it). Copy link shows a small "Copied" tick; Facebook, WhatsApp and the
 * existing Portfolio PDF.
 */
export function ProfileShareMenu({ url, name, pdfHref, publicHref }: { url: string; name: string; pdfHref: string; publicHref: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef(0);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const fine = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the link stays visible in the address bar */
    }
  };
  const text = t("designerProfile.x.shareText", { name });

  return (
    <div
      ref={box}
      className="dp-shw"
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || !fine()) return;
        window.clearTimeout(hoverTimer.current);
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse" || !fine()) return;
        hoverTimer.current = window.setTimeout(() => setOpen(false), 220);
      }}
    >
      <button type="button" className="dp-b1" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <svg {...ICON}>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
        </svg>
        {t("designerProfile.share")}
      </button>
      {open && (
        <div className="dp-shm" role="menu" aria-label={t("designerProfile.x.shareMenu")}>
          {publicHref && (
            <>
              <a href={publicHref} role="menuitem" className="dp-vpp">
                <svg {...ICON}>
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="flex flex-col leading-tight">
                  {t("designerProfile.x.viewPublic")}
                  <small className="text-xs font-semibold text-[#5F626B]">{t("designerProfile.x.viewPublicSub")}</small>
                </span>
              </a>
              <i className="dp-shdiv" aria-hidden />
            </>
          )}
          <button type="button" role="menuitem" onClick={copy}>
            <svg {...ICON}>
              <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
            </svg>
            {t("designerProfile.x.copyLink")}
            {copied && (
              <span className="dp-ok" role="status">
                ✓ {t("designerProfile.x.copied")}
              </span>
            )}
          </button>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" role="menuitem">
            <svg {...ICON}>
              <path d="M14 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5H17V4.4c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9v2.4H8.5v3H11V21" />
            </svg>
            Facebook
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" role="menuitem">
            <svg {...ICON}>
              <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.2z" />
              <path d="M9 9.5c.3 1.8 1.7 3.3 3.5 3.9l1.2-1 1.8.8-.4 1.6c-3.4.2-6.6-2.8-6.6-6.2l1.6-.4.8 1.8z" />
            </svg>
            WhatsApp
          </a>
          <a href={pdfHref} role="menuitem">
            <svg {...ICON}>
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M12 12v6M9 15l3 3 3-3" />
            </svg>
            {t("designerProfile.x.portfolioPdf")}
          </a>
        </div>
      )}
    </div>
  );
}
