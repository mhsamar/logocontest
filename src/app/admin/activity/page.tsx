import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { activityFeed } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.activity.title"), robots: { index: false } };
}

// A-21 Activity (BLUEPRINT §13.2 item 3): what people did, newest first.
export default async function AdminActivityPage() {
  await requirePermission("dashboard.view");
  const [{ t, locale }, items] = await Promise.all([getI18n(), activityFeed(80)]);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.activity.title")} lead={t("admin.activity.lead")} />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.activity.none")}</p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
          {items.map((a, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-3 text-sm">
              {a.person ? (
                <Link href={`/admin/users/${a.person.id}`} className="font-semibold text-ink hover:text-primary">
                  {a.person.name}
                </Link>
              ) : (
                <span className="font-semibold text-muted">{t("admin.activity.someone")}</span>
              )}
              <span className="text-ink">{t(`admin.activity.kinds.${a.kind}`, { amount: a.kind === "withdrawal" ? formatNumber(Number(a.label), locale) : "" })}</span>
              {a.kind !== "withdrawal" && a.label && (a.href ? <Link href={a.href} className="font-medium text-primary hover:underline">{a.label}</Link> : <span className="text-muted">{a.label}</span>)}
              <span className="ml-auto text-xs text-muted">{when(a.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
