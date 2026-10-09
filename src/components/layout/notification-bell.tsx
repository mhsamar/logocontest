"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { markAllRead, markRead } from "@/lib/notifications/actions";
import type { ShownNotification } from "@/lib/notifications/render";

const ICON: Record<ShownNotification["type"], { d: string; tone: string }> = {
  entry_new: { d: "M12 5v14M5 12h14", tone: "bg-primary/10 text-primary" },
  entry_comment: { d: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z", tone: "bg-[#e8f1ff] text-[#1d4ed8]" },
  contest_comment: { d: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z", tone: "bg-[#e8f1ff] text-[#1d4ed8]" },
  brief_updated: { d: "M4 20h4L19 9l-4-4L4 16Z", tone: "bg-[#f1ecff] text-[#5b21b6]" },
  contest_extended: { d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  entry_rated: { d: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  entry_rejected: { d: "M6 6l12 12M18 6L6 18", tone: "bg-danger/10 text-danger" },
  winner_picked: { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  contest_closed: { d: "M5 12.5l4.5 4.5L19 7.5", tone: "bg-canvas text-ink" },
  handover_submitted: { d: "M12 3v12M7 10l5 5 5-5M5 21h14", tone: "bg-[#e8f1ff] text-[#1d4ed8]" },
  handover_revision: { d: "M4 20h4L19 9l-4-4L4 16Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  handover_approved: { d: "M3 7h18v12H3ZM3 11h18M16 15h2", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  withdrawal_paid: { d: "M5 12.5l4.5 4.5L19 7.5", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  withdrawal_rejected: { d: "M6 6l12 12M18 6L6 18", tone: "bg-danger/10 text-danger" },
  ending_soon: { d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  ending_soon_extend: { d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  ending_soon_designer: { d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  judging_started: { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  judging_reminder: { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z", tone: "bg-primary/10 text-primary" },
  win_cancelled: { d: "M6 6l12 12M18 6L6 18", tone: "bg-danger/10 text-danger" },
  repick_winner: { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z", tone: "bg-primary/10 text-primary" },
  no_result_client: { d: "M5 12h14", tone: "bg-canvas text-ink" },
  no_result_share: { d: "M3 7h18v12H3ZM3 11h18M16 15h2", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  handover_approved_held: { d: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  prize_released: { d: "M3 7h18v12H3ZM3 11h18M16 15h2", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  claim_opened: { d: "M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z", tone: "bg-danger/10 text-danger" },
  claim_opened_admin: { d: "M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z", tone: "bg-danger/10 text-danger" },
  claim_rejected_client: { d: "M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6Z", tone: "bg-canvas text-ink" },
  claim_rejected_designer: { d: "M5 12.5l4.5 4.5L19 7.5", tone: "bg-[#e7f8f0] text-[#0f6b45]" },
  claim_correction_client: { d: "M4 20h4L19 9l-4-4L4 16Z", tone: "bg-[#fff7e0] text-[#8a5105]" },
  claim_correction_designer: { d: "M4 20h4L19 9l-4-4L4 16Z", tone: "bg-danger/10 text-danger" },
  claim_upheld_client: { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z", tone: "bg-primary/10 text-primary" },
  claim_fined: { d: "M6 6l12 12M18 6L6 18", tone: "bg-danger/10 text-danger" },
  claim_banned: { d: "M6 6l12 12M18 6L6 18", tone: "bg-danger/10 text-danger" },
};

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
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface shadow-panel ring-1 ring-line animate-fade-in">
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
                const icon = ICON[n.type];
                const inner = (
                  <>
                    <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", icon.tone)} aria-hidden>
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={icon.d} />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cx("block text-sm leading-snug", n.read ? "text-muted" : "font-medium text-ink")}>{n.text}</span>
                      <span className="mt-0.5 block text-xs text-muted">{n.ago}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                  </>
                );
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
