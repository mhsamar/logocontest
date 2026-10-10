import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkAllButton } from "@/components/layout/mark-all-button";
import { NotificationRow } from "@/components/layout/notification-row";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { listNotifications } from "@/lib/notifications";
import { CATEGORIES, CATEGORY_STYLE, isCategory } from "@/lib/notifications/categories";
import { renderNotification } from "@/lib/notifications/render";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("notifications.metaTitle"), robots: { index: false } };
}

// All notifications (owner, 2026-10-08), coloured and filterable by category (owner, 2026-10-09).
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const sp = await searchParams;
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?next=/notifications");
  const now = new Date();
  const all = (await listNotifications(user.id, 200)).map((n) => renderNotification(n, t, locale, now));
  const present = CATEGORIES.filter((c) => all.some((n) => n.category === c));
  const active = typeof sp.type === "string" && isCategory(sp.type) && present.includes(sp.type) ? sp.type : null;
  const items = active ? all.filter((n) => n.category === active) : all;
  const unread = (c: string | null) => all.filter((n) => !n.read && (!c || n.category === c)).length;
  const chip = (on: boolean) =>
    cx("inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[14px] px-4 text-[15px] font-semibold transition-colors", on ? "bg-ink text-white" : "bg-chip text-ink hover:bg-line");

  return (
    <PageShell>
      <Panel className="flex-1">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageTitle lead={t("notifications.title")} />
            {all.some((n) => !n.read) && <MarkAllButton label={t("notifications.markAll")} />}
          </div>

          {present.length > 1 && (
            <nav aria-label={t("notifications.filter")} className="-mx-4 mt-5 overflow-x-auto px-4">
              <ul className="m-0 flex list-none gap-2 p-0 sm:flex-wrap">
                <li>
                  <Link href="/notifications" className={chip(!active)} aria-current={!active ? "page" : undefined}>
                    {t("notifications.all")}
                    {unread(null) > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-white">{unread(null)}</span>}
                  </Link>
                </li>
                {present.map((c) => (
                  <li key={c}>
                    <Link href={`/notifications?type=${c}`} className={chip(active === c)} aria-current={active === c ? "page" : undefined}>
                      <span className={cx("size-2 rounded-full", CATEGORY_STYLE[c].bar)} aria-hidden />
                      {t(`notifications.categories.${c}`)}
                      {unread(c) > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-white">{unread(c)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {items.length === 0 ? (
            <div className="mt-8">
              <EmptyState title={t("notifications.empty")} />
            </div>
          ) : (
            <ul className="lc-card m-0 mt-6 list-none divide-y divide-line overflow-hidden p-0">
              {items.map((n) => {
                const body = <NotificationRow n={n} label={t(`notifications.categories.${n.category}`)} />;
                return (
                  <li key={n.id} className="relative">
                    {!n.read && <span className={cx("absolute inset-y-0 left-0 w-1", CATEGORY_STYLE[n.category].bar)} aria-hidden />}
                    {n.link ? (
                      <Link href={n.link} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-chip">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 px-5 py-4">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
