"use client";

import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";

const BTN =
  "flex size-10 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-line transition-colors hover:text-primary hover:ring-primary";

/** P-03 stats card: share this contest on Facebook or WhatsApp, or copy its link (owner, 2026-10-08). */
export function ShareContest({ url, brand }: { url: string; brand: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const text = t("contest.share.text", { brand });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("contest.share.copied"));
    } catch {
      toast(t("auth.errors.generic"), "danger");
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-ink">{t("contest.share.title")}</p>
      <div className="flex gap-2">
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={BTN}>
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M14 8.6V11h3l-.5 3H14v8h-3.5v-8H8v-3h2.5V8.3C10.5 5.7 12 4 14.7 4c1 0 2 .1 2.3.2v2.7h-1.6c-1.1 0-1.4.6-1.4 1.7Z" />
          </svg>
        </a>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={BTN}>
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm0 16.3c-1.4 0-2.8-.4-4-1.1l-.3-.2-2.7.7.7-2.6-.2-.3a7.3 7.3 0 1 1 6.5 3.5Zm4-5.4c-.2-.1-1.3-.7-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.7 4.2 3.7 1.6.7 2.2.7 3 .6.5-.1 1.3-.6 1.5-1.1.2-.5.2-1 .1-1.1l-.5-.3Z" />
          </svg>
        </a>
        <button type="button" onClick={copy} aria-label={t("contest.share.copy")} className={BTN}>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
