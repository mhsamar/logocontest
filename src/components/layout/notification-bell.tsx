"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { markAllRead, markRead } from "@/lib/notifications/actions";
import type { ShownNotification } from "@/lib/notifications/render";
import { NotificationRow } from "./notification-row";


/** Header bell (owner, 2026-10-08): unread count, the latest notifications, mark all as read. */
export function NotificationBell({ items, unread }: { items: ShownNotification[]; unread: number }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const count = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(Math.min(unread, 99));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${t("notifications.open")}${unread ? ` (${count})` : ""}`}
        className="relative flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-white/70"
      >
        <svg viewBox="0 0 24 24" className={cx("size-5", unread > 0 && "origin-top animate-wiggle")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-bold leading-[1.1rem] text-white ring-2 ring-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute -right-14 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] lg:right-0 overflow-hidden rounded-2xl bg-surface shadow-panel ring-1 ring-line animate-fade-in">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="font-semibold text-ink">{t("notifications.title")}</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    await markAllRead();
                    router.refresh();
                  })
                }
                className="text-xs font-semibold text-primary hover:underline"
              >
                {t("notifications.markAll")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{t("notifications.empty")}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const inner = <NotificationRow n={n} label={t(`notifications.categories.${n.category}`)} size="sm" />;
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => (setOpen(false), !n.read && void markRead(n.id))} className="flex items-start gap-3 px-4 py-3 hover:bg-canvas">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-primary hover:bg-canvas">
            {t("notifications.seeAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
