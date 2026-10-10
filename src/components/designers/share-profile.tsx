"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Share your profile (UI-JOURNEY D-02, P-06): the link with copy and share
 * buttons, and the QR code with a PNG download. `qrSvg` is made on our server.
 */
export function ShareProfile({
  url,
  qrSvg,
  qrDownloadHref,
  name,
  stacked,
  className,
}: {
  url: string;
  qrSvg: string;
  qrDownloadHref: string;
  name: string;
  /** One column with the QR on top, for narrow places such as the share sheet. */
  stacked?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [canNativeShare, setCanNativeShare] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator is only readable in the browser
  useEffect(() => setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("designerDash.share.copied"));
    } catch {
      toast(t("auth.errors.generic"), "danger");
    }
  };
  const text = t("designerDash.share.text", { name });
  const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition-colors";

  return (
    <div className={cx("grid gap-5", !stacked && "sm:grid-cols-[1fr_auto] sm:items-center", className)}>
      <div className={cx("min-w-0", stacked && "order-2")}>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="profile-link">
          {t("designerDash.share.linkLabel")}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="profile-link"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 w-0 flex-1 rounded-[10px] bg-chip px-3 font-mono text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="button" onClick={copy} className={cx(btn, "bg-ink text-white hover:bg-primary-dark")}>
            {t("designerDash.share.copy")}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(btn, "bg-surface text-ink ring-1 ring-inset ring-line hover:ring-primary")}
          >
            Facebook
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cx(btn, "bg-surface text-ink ring-1 ring-inset ring-line hover:ring-primary")}
          >
            WhatsApp
          </a>
          {canNativeShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: name, text, url }).catch(() => {})}
              className={cx(btn, "bg-surface text-ink ring-1 ring-inset ring-line hover:ring-primary")}
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("designerDash.share.more")}
            </button>
          )}
        </div>
      </div>

      <div className={cx("flex flex-col items-center gap-2", stacked && "order-1")}>
        <div
          className="size-36 rounded-[14px] bg-white p-2 shadow-card ring-1 ring-line [&>svg]:h-full [&>svg]:w-full"
          role="img"
          aria-label={t("designerDash.share.qrLabel")}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <a href={qrDownloadHref} download className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("designerDash.share.downloadQr")}
        </a>
      </div>
    </div>
  );
}
