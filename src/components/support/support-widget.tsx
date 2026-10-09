"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { myUnreadCount } from "@/lib/support/actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { SupportChat } from "./support-chat";

/** S-01: the round chat button in the corner of every page, for signed-in clients and designers. */
export function SupportWidget({ unread: initialUnread }: { unread: number }) {
  const { t } = useI18n();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);

  useEffect(() => {
    if (open) return;
    const id = window.setInterval(async () => document.visibilityState === "visible" && setUnread(await myUnreadCount()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  if (path === "/support") return null;
  return (
    <>
      {open && (
        <div role="dialog" aria-label={t("support.title")} className="fixed inset-x-2 bottom-20 z-50 flex h-[min(34rem,75vh)] flex-col overflow-hidden rounded-3xl bg-canvas shadow-raised ring-1 ring-line sm:inset-x-auto sm:right-4 sm:w-96">
          <div className="flex items-center justify-between gap-2 bg-ink px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="font-semibold">{t("support.team")}</p>
              <p className="truncate text-xs text-white/70">{t("support.lead")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link href="/support" className="rounded-full px-2 py-1 text-xs font-semibold hover:bg-white/10" onClick={() => setOpen(false)}>
                {t("support.fullPage")}
              </Link>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("support.close")} className="flex size-9 items-center justify-center rounded-full text-lg hover:bg-white/10">
                ×
              </button>
            </div>
          </div>
          <SupportChat className="flex-1" />
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setUnread(0);
        }}
        aria-label={t(open ? "support.close" : "support.open")}
        aria-expanded={open}
        className={cx("fixed bottom-4 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-raised transition-transform hover:scale-105", open && "bg-ink")}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z" />}
        </svg>
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-ink ring-2 ring-white">{unread}</span>
        )}
      </button>
    </>
  );
}
