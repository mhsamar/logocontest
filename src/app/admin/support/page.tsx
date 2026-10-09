import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { AdminHead } from "@/components/admin/page-head";
import { SupportThreadPanel } from "@/components/admin/support-reply";
import { requirePermission } from "@/lib/admin/core";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatBdMobile } from "@/lib/phone";
import { inbox, threadDetail, threadIdOf } from "@/lib/support/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.support.title"), robots: { index: false } };
}

// A-24 Support inbox (BLUEPRINT §13.2 item 5): conversation list and the open chat; refreshes every 8 s.
export default async function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  await requirePermission("support.view");
  const sp = await searchParams;
  const status = sp.status === "closed" ? "closed" : "open";
  const threadParam = typeof sp.thread === "string" ? sp.thread : typeof sp.user === "string" ? await threadIdOf(sp.user) : null;
  const [{ t, locale }, list, detail] = await Promise.all([getI18n(), inbox(status), threadParam ? threadDetail(threadParam) : null]);
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
  const href = (p: { status?: string; thread?: string }) => `/admin/support?${new URLSearchParams({ ...(p.status && p.status !== "open" ? { status: p.status } : {}), ...(p.thread ? { thread: p.thread } : {}) })}`;

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={8} />
      <AdminHead title={t("admin.support.title")} lead={t("admin.support.lead")} />
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className={cx("overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line", detail && "hidden lg:block")}>
          <div className="flex gap-1 border-b border-line p-2">
            {(["open", "closed"] as const).map((s) => (
              <Link key={s} href={href({ status: s })} aria-current={s === status ? "page" : undefined} className={cx("inline-flex min-h-9 flex-1 items-center justify-center rounded-full text-sm font-semibold", s === status ? "bg-ink text-white" : "text-ink hover:bg-canvas")}>
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
                    {detail.user.mobile ? formatBdMobile(detail.user.mobile) : ""}
                    {detail.user.email ? ` · ${detail.user.email}` : ""}
                  </p>
                </div>
                <Link href={`/admin/users/${detail.user.id}`} className="text-sm font-semibold text-primary hover:underline">
                  {t("admin.support.profile")} →
                </Link>
              </div>
              <SupportThreadPanel key={detail.thread.id} threadId={detail.thread.id} status={detail.thread.status} messages={detail.messages} />
            </>
          ) : (
            <p className="m-auto text-sm text-muted">{t("admin.support.pick")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
