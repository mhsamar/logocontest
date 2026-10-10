"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { loadRecentActivity, type RecentActivity } from "@/lib/admin/recent-activity";
import { timeAgo } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber, formatTaka } from "@/lib/money";
import { AdminIcon, type AdminIconName } from "./icons";

const KIND_ICON: Record<RecentActivity["items"][number]["kind"], AdminIconName> = {
  signup_client: "joined",
  signup_designer: "joined",
  contest_started: "contests",
  contest_paid: "payments",
  design_sent: "designs",
  comment: "comment",
  files_approved: "check",
  withdrawal: "withdrawals",
};

/** The bell, top right: a drawer with last-30-day numbers and the newest activity (shell-activity-drawer-open.html). */
export function ActivityDrawer() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<RecentActivity | null | undefined>(undefined);
  const [loading, start] = useTransition();
  const closeBtn = useRef<HTMLButtonElement>(null);

  const show = () => {
    setOpen(true);
    start(async () => setData(await loadRecentActivity().catch(() => null)));
  };

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const num = (n: number) => formatNumber(n, locale);
  const now = new Date();

  return (
    <>
      <button type="button" onClick={show} aria-label={t("admin.drawer.title")} aria-expanded={open} className="flex size-11 items-center justify-center rounded-[12px] border border-adm-line bg-surface text-adm-strong hover:bg-adm-bg">
        <AdminIcon name="bell" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <button type="button" aria-label={t("admin.drawer.close")} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/45" />
          <aside role="dialog" aria-modal="true" aria-label={t("admin.drawer.title")} className="relative flex h-full w-[min(420px,100%)] flex-col bg-surface shadow-[-18px_0_48px_rgb(17_18_22/0.18)]">
            <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
              <div className="flex flex-col">
                <strong className="lc-d text-xl font-semibold tracking-[-0.02em]">{t("admin.drawer.title")}</strong>
                <span className="text-[14.5px] text-muted">{t("admin.drawer.lead")}</span>
              </div>
              <button ref={closeBtn} type="button" onClick={() => setOpen(false)} aria-label={t("admin.drawer.close")} className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-adm-line bg-surface text-adm-strong hover:bg-adm-bg">
                <AdminIcon name="close" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-5" aria-busy={loading}>
              {data === undefined || loading ? (
                <div className="grid grid-cols-2 gap-2.5" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[78px] animate-pulse rounded-[12px] bg-adm-bg" />
                  ))}
                </div>
              ) : data === null ? (
                <p className="m-0 rounded-[12px] bg-adm-bg px-4 py-8 text-center text-[15px] text-muted">{t("admin.drawer.unavailable")}</p>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[15px] font-bold">{t("admin.drawer.last30")}</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { label: t("admin.dashboard.tiles.live"), value: num(data.stats.live) },
                        { label: t("admin.dashboard.tiles.revenue"), value: formatTaka(data.stats.revenue, locale) },
                        { label: t("admin.dashboard.tiles.withdrawals"), value: num(data.stats.withdrawals) },
                        { label: t("admin.dashboard.tiles.reports"), value: num(data.stats.reports) },
                      ].map((s) => (
                        <div key={s.label} className="flex flex-col gap-1.5 rounded-[12px] bg-adm-bg p-3.5">
                          <span className="text-sm text-muted">{s.label}</span>
                          <strong className="lc-d text-[22px] font-semibold tabular-nums">{s.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <span className="mb-1 text-[15px] font-bold">{t("admin.drawer.activities")}</span>
                    {data.items.length === 0 ? (
                      <p className="m-0 py-6 text-center text-[15px] text-muted">{t("admin.activity.none")}</p>
                    ) : (
                      data.items.map((a, i) => {
                        const who = a.name ?? t("admin.activity.someone");
                        const line = a.kind === "withdrawal" ? `${who} · ${formatTaka(Number(a.label), locale)}` : a.label ? `${who} · ${a.label}` : who;
                        const row = (
                          <>
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-adm-bg text-adm-strong">
                              <AdminIcon name={KIND_ICON[a.kind]} size={17} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <strong className="text-[15.5px] font-bold">{t(`admin.drawer.kinds.${a.kind}`)}</strong>
                              <span className="truncate text-[14.5px] text-muted">{line}</span>
                            </span>
                            <span className="whitespace-nowrap text-[13.5px] text-muted">{timeAgo(new Date(a.at), now, locale)}</span>
                          </>
                        );
                        return a.href ? (
                          <Link key={i} href={a.href} onClick={() => setOpen(false)} className="flex gap-3 border-b border-adm-line-soft py-3 hover:bg-adm-bg/60">
                            {row}
                          </Link>
                        ) : (
                          <div key={i} className="flex gap-3 border-b border-adm-line-soft py-3">
                            {row}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2.5 border-t border-adm-line px-5 py-4">
              <Link href="/admin/activity" onClick={() => setOpen(false)} className="flex h-12 flex-1 items-center justify-center rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-adm-deep">
                {t("admin.drawer.viewAll")}
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="flex h-12 items-center justify-center rounded-[12px] border border-adm-line px-5 text-[15px] font-bold text-adm-strong hover:bg-adm-bg">
                {t("common.cancel")}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
