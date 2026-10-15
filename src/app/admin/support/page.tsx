import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminHead } from "@/components/admin/page-head";
import { SupportThreadPanel } from "@/components/admin/support-reply";
import { requirePermission } from "@/lib/admin/core";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatMobile } from "@/lib/phone";
import { inbox, supportStaff, threadDetail, threadIdOf, type InboxView } from "@/lib/support/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.support.title"), robots: { index: false } };
}

// A-24 Support inbox (BLUEPRINT §13.2 item 5): conversation list and the open chat; refreshes every 8 s.
export default async function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  const me = await requirePermission("support.view");
  const sp = await searchParams;
  // Lists (owner, 2026-10-15): open, waiting for a person (the AI handed them over), mine, closed.
  const status: InboxView = sp.status === "closed" || sp.status === "needs" || sp.status === "mine" ? sp.status : "open";
  const threadParam = typeof sp.thread === "string" ? sp.thread : typeof sp.user === "string" ? await threadIdOf(sp.user) : null;
  const [{ t, locale }, list, detail, staff] = await Promise.all([getI18n(), inbox(status, me.id), threadParam ? threadDetail(threadParam) : null, supportStaff()]);
  const modeTag = (r: { mode: "ai" | "waiting" | "human"; assignedName: string | null }) =>
    r.mode === "ai" ? (
      <span className="shrink-0 rounded-full bg-[#F1EAFE] px-2 py-0.5 text-[10.5px] font-extrabold text-[#6D28D9]">✨ {t("admin.support.modes.ai")}</span>
    ) : r.mode === "waiting" ? (
      <span className="shrink-0 rounded-full bg-[#FFF1E6] px-2 py-0.5 text-[10.5px] font-extrabold text-[#B45309]">{t("admin.support.modes.waiting")}</span>
    ) : r.assignedName ? (
      <span className="max-w-[9rem] shrink-0 truncate rounded-full bg-canvas px-2 py-0.5 text-[10.5px] font-bold text-muted">{t("admin.support.modes.human", { name: r.assignedName })}</span>
    ) : null;
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const href = (p: { status?: string; thread?: string }) => `/admin/support?${new URLSearchParams({ ...(p.status && p.status !== "open" ? { status: p.status } : {}), ...(p.thread ? { thread: p.thread } : {}) })}`;

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={8} />
      <AdminHead title={t("admin.support.title")} lead={t("admin.support.lead")} />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className={cx("overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line", detail && "hidden lg:block")}>
          <div className="flex gap-1 border-b border-line p-2">
            {(["open", "needs", "mine", "closed"] as const).map((s) => (
              <Link key={s} href={href({ status: s })} aria-current={s === status ? "page" : undefined} className={cx("inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-2 text-[13px] font-semibold", s === status ? "bg-ink text-white" : "text-ink hover:bg-canvas")}>
                {t(`admin.support.${s}`)}
              </Link>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{t("admin.support.none")}</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={href({ status, thread: r.id })} className={cx("block px-4 py-3 hover:bg-canvas", detail?.thread.id === r.id && "bg-canvas")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx("truncate text-sm", r.unreadByAdmin > 0 ? "font-bold text-ink" : "font-semibold text-ink")}>{r.user?.name ?? "—"}</span>
                      {r.pro && <span className="shrink-0 rounded-full bg-[linear-gradient(120deg,#8B0000,#B3261E_45%,#D9A52B)] px-2 py-0.5 text-[10.5px] font-extrabold tracking-[0.05em] text-white">PRO</span>}
                      {r.status === "open" && modeTag(r)}
                      <span className="shrink-0 text-xs text-muted">{when(r.lastMessageAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-xs text-muted">{r.last ?? ""}</span>
                      {r.unreadByAdmin > 0 && <span className="ml-auto shrink-0 rounded-full bg-primary px-2 text-xs font-bold text-white">{r.unreadByAdmin}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cx("flex h-[75vh] flex-col overflow-hidden rounded-2xl bg-canvas shadow-card ring-1 ring-line", !detail && "hidden lg:flex")}>
          {detail ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-3">
                <Link href={href({ status })} className="text-sm font-semibold text-primary lg:hidden">
                  ← {t("admin.support.back")}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {detail.user.name} <span className="ml-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{t(`admin.live.roles.${detail.user.role}` as MessageKey)}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    {detail.user.mobile ? formatMobile(detail.user.mobile) : ""}
                    {detail.user.email ? ` · ${detail.user.email}` : ""}
                  </p>
                </div>
                <Link href={`/admin/users/${detail.user.id}`} className="text-sm font-semibold text-primary hover:underline">
                  {t("admin.support.profile")} →
                </Link>
              </div>
              <SupportThreadPanel key={detail.thread.id} thread={detail.thread} messages={detail.messages} staff={staff} meId={me.id} />
            </>
          ) : (
            <p className="m-auto text-sm text-muted">{t("admin.support.pick")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
