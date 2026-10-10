"use client";

import Link from "next/link";
import { useState } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { isExternal, NOTICE_COOKIE, NOTICE_TONES, type Notice } from "@/lib/content/notice-rules";

/** Site-wide notice bar (A-17). Closing it hides this version until the end of the day. */
export function NoticeBar({ notice, preview = false }: { notice: Notice; preview?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const close = () => {
    if (!preview) {
      const end = new Date();
      end.setHours(24, 0, 0, 0);
      document.cookie = `${NOTICE_COOKIE}=${notice.id}; path=/; expires=${end.toUTCString()}; samesite=lax`;
    }
    setOpen(false);
  };

  const text = <span className="font-medium">{notice.text}</span>;
  return (
    <div role="region" data-notice-bar aria-label={t("notice.label")} className={cx("relative z-40 px-11 py-2 text-center text-sm leading-snug", NOTICE_TONES[notice.tone])}>
      {notice.link ? (
        isExternal(notice.link) ? (
          <a href={notice.link} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            {text} <span aria-hidden>→</span>
          </a>
        ) : (
          <Link href={notice.link} className="underline-offset-2 hover:underline">
            {text} <span aria-hidden>→</span>
          </Link>
        )
      ) : (
        text
      )}
      <button
        type="button"
        onClick={close}
        aria-label={t("notice.close")}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full opacity-80 hover:bg-black/10 hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
