import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarkAllButton } from "@/components/layout/mark-all-button";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { listNotifications } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("notifications.metaTitle"), robots: { index: false } };
}

// All notifications (owner, 2026-10-08)
export default async function NotificationsPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?next=/notifications");
  const now = new Date();
  const items = (await listNotifications(user.id, 100)).map((n) => renderNotification(n, t, locale, now));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h1 font-bold tracking-tight text-ink">{t("notifications.title")}</h1>
        {items.some((n) => !n.read) && <MarkAllButton label={t("notifications.markAll")} />}
      </div>
      {items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-4 py-12 text-center text-muted">{t("notifications.empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
          {items.map((n, i) => {
            const body = (
              <>
                {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                <span className={cx("min-w-0 flex-1", n.read && "pl-5")}>
                  <span className={cx("block leading-snug", n.read ? "text-muted" : "font-medium text-ink")}>{n.text}</span>
                  <span className="mt-0.5 block text-xs text-muted">{n.ago}</span>
                </span>
              </>
            );
            return (
              <li key={n.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                {n.link ? (
                  <Link href={n.link} className="flex items-start gap-3 px-4 py-3.5 hover:bg-canvas">
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
