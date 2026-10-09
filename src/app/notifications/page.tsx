import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkAllButton } from "@/components/layout/mark-all-button";
import { NotificationRow } from "@/components/layout/notification-row";
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
    cx("inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors", on ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-primary");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h1 font-bold tracking-tight text-ink">{t("notifications.title")}</h1>
        {all.some((n) => !n.read) && <MarkAllButton label={t("notifications.markAll")} />}
      </div>

      {present.length > 1 && (
        <nav aria-label={t("notifications.filter")} className="-mx-4 mt-5 overflow-x-auto px-4">
          <ul className="flex gap-2 sm:flex-wrap">
            <li>
              <Link href="/notifications" className={chip(!active)} aria-current={!active ? "page" : undefined}>
                {t("notifications.all")}
                {unread(null) > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white">{unread(null)}</span>}
              </Link>
            </li>
            {present.map((c) => (
              <li key={c}>
                <Link href={`/notifications?type=${c}`} className={chip(active === c)} aria-current={active === c ? "page" : undefined}>
                  <span className={cx("size-2 rounded-full", CATEGORY_STYLE[c].bar)} aria-hidden />
                  {t(`notifications.categories.${c}`)}
                  {unread(c) > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white">{unread(c)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-4 py-12 text-center text-muted">{t("notifications.empty")}</p>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
          {items.map((n, i) => {
            const body = <NotificationRow n={n} label={t(`notifications.categories.${n.category}`)} />;
            return (
              <li key={n.id} className="relative animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                {!n.read && <span className={cx("absolute inset-y-0 left-0 w-1", CATEGORY_STYLE[n.category].bar)} aria-hidden />}
                {n.link ? (
                  <Link href={n.link} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-canvas">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
