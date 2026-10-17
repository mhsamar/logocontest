"use client";

import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { facebookShareUrl, pinterestShareUrl, whatsappShareUrl } from "@/lib/share/links";

const BTN =
  "flex size-11 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line transition-colors hover:text-primary hover:ring-primary";

/**
 * Share on Facebook, save on Pinterest, send on WhatsApp or copy the link (owner, 2026-10-18). Pinterest shows only
 * with a picture to pin (`media`, a full https link). Each opens the network's own share page in a new tab.
 */
export function ShareButtons({ url, media, text, className }: { url: string; media?: string | null; text: string; className?: string }) {
  const { t } = useI18n();
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("share.copied"));
    } catch {
      toast(t("share.failed"), "danger");
    }
  };

  return (
    <div className={cx("flex flex-wrap gap-2", className)} data-share>
      <a href={facebookShareUrl(url)} target="_blank" rel="noopener noreferrer" aria-label={t("share.facebook")} title={t("share.facebook")} className={BTN} data-share-to="facebook">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
          <path d="M14 8.6V11h3l-.5 3H14v8h-3.5v-8H8v-3h2.5V8.3C10.5 5.7 12 4 14.7 4c1 0 2 .1 2.3.2v2.7h-1.6c-1.1 0-1.4.6-1.4 1.7Z" />
        </svg>
      </a>
      {media && (
        <a href={pinterestShareUrl({ url, media, description: text })} target="_blank" rel="noopener noreferrer" aria-label={t("share.pinterest")} title={t("share.pinterest")} className={BTN} data-share-to="pinterest">
          <PinterestIcon className="size-[18px]" />
        </a>
      )}
      <a href={whatsappShareUrl(text, url)} target="_blank" rel="noopener noreferrer" aria-label={t("share.whatsapp")} title={t("share.whatsapp")} className={BTN} data-share-to="whatsapp">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden>
          <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.3c-1.4 0-2.8-.4-4-1.1l-.3-.2-2.7.7.7-2.6-.2-.3a7.3 7.3 0 1 1 6.5 3.5Zm4-5.4c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.2 3.7 1.6.7 2.2.7 3 .6.5-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1l-.5-.3Z" />
        </svg>
      </a>
      <button type="button" onClick={copy} aria-label={t("share.copy")} title={t("share.copy")} className={BTN} data-share-to="copy">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
      </button>
    </div>
  );
}

/** The Pinterest "P" mark. */
export function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.64 19.31c-.09-.79-.17-2 .03-2.86l1.17-4.97s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.87 3.14-4.57 0-2.39-1.72-4.06-4.17-4.06-2.84 0-4.51 2.13-4.51 4.34 0 .86.33 1.78.74 2.28.08.1.09.19.07.29l-.28 1.13c-.04.18-.14.22-.33.13-1.25-.58-2.03-2.4-2.03-3.87 0-3.15 2.29-6.04 6.6-6.04 3.46 0 6.16 2.47 6.16 5.77 0 3.45-2.17 6.22-5.19 6.22-1.01 0-1.97-.53-2.29-1.15l-.62 2.38c-.23.87-.84 1.96-1.25 2.62A10 10 0 1 0 12 2Z" />
    </svg>
  );
}
