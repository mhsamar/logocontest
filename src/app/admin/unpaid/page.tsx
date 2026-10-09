import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { StatusPill } from "@/components/admin/table-bits";
import { unpaidContests } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { formatBdMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.unpaid.title"), robots: { index: false } };
}

// A-22 Unpaid contests (BLUEPRINT §13.2 item 4): started but not paid, with Call and Message.
export default async function AdminUnpaidPage() {
  const me = await requirePermission("unpaid.view");
  const canMessage = hasPermission(me, "messages.manage");
  const [{ t, locale }, rows] = await Promise.all([getI18n(), unpaidContests()]);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.unpaid.title")} lead={t("admin.unpaid.lead")} />
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.unpaid.none")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  <Link href={`/admin/contests/${r.slug}`} className="hover:text-primary">
                    {r.brand || "—"}
                  </Link>
                </p>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {r.client ? (
                    <Link href={`/admin/users/${r.client.id}`} className="hover:text-primary">
                      {r.client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {r.client?.mobile ? ` · ${formatBdMobile(r.client.mobile)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusPill tone={r.status === "pending_payment" ? "warn" : "muted"}>{t(`admin.unpaid.statuses.${r.status}`)}</StatusPill>
                {r.step && <span className="text-muted">{t("admin.unpaid.stepOf", { n: r.step })}</span>}
                {r.amount > 0 && <span className="font-semibold text-ink">{formatTaka(r.amount, locale)}</span>}
                <span className="w-full text-xs text-muted md:w-auto">{when(r.updatedAt)}</span>
              </div>
              <div className="flex gap-2">
                {r.client?.mobile && (
                  <a href={`tel:${r.client.mobile}`} className="inline-flex min-h-10 items-center rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line hover:ring-primary">
                    {t("admin.unpaid.call")}
                  </a>
                )}
                {canMessage && r.client && (
                  <Link href={`/admin/messages?to=${r.client.id}`} className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
                    {t("admin.unpaid.message")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
