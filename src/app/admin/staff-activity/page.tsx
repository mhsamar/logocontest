import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHead } from "@/components/admin/page-head";
import { AuditTabs, durationText, whenText } from "@/components/admin/session-bits";
import { AdmCard, AdmEmpty, Pill } from "@/components/admin/ui";
import { superAdmin } from "@/lib/admin/core";
import { staffActivity } from "@/lib/admin/sessions";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.security.staff.title"), robots: { index: false } };
}

const DAYS = 30;

// Admin › Staff activity (owner, 2026-10-14; Super admin only): each staff member's logins, working time and actions.
export default async function StaffActivityPage() {
  const me = await superAdmin();
  if (!me) notFound();
  const [{ t, locale }, staff] = await Promise.all([getI18n(), staffActivity(DAYS)]);
  const n = (v: number) => formatNumber(v, locale);
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.security.staff.title")} lead={t("admin.security.staff.lead", { days: n(DAYS) })} />
      <AuditTabs current="staff" t={t} staff />
      {staff.length === 0 ? (
        <AdmEmpty>{t("admin.security.staff.empty")}</AdmEmpty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <AdmCard key={s.id} as="article" className="flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/staff-activity/${s.id}`} className="text-[17px] font-semibold text-ink hover:text-primary">
                  {s.name}
                </Link>
                {s.superAdmin && <Pill tone="gold">{t("admin.users.x.superAdmin")}</Pill>}
                {!s.active && <Pill tone="neutral">{t("admin.security.staff.off")}</Pill>}
                {s.online && <Pill tone="good">{t("admin.security.onlineNow")}</Pill>}
              </div>
              {s.title && <span className="-mt-2 text-sm text-muted">{s.title}</span>}
              <dl className="m-0 grid grid-cols-3 gap-2 text-sm">
                {[
                  [t("admin.security.staff.signIns"), n(s.signIns)],
                  [t("admin.security.staff.worked"), durationText(s.activeSeconds, t, locale)],
                  [t("admin.security.staff.actions"), n(s.actions)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[10px] bg-adm-bg px-2.5 py-2">
                    <dt className="text-[12.5px] text-muted">{k}</dt>
                    <dd className="m-0 font-semibold text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <span className="text-[13.5px] text-muted">{s.lastSeen ? t("admin.security.staff.lastSeen", { when: whenText(s.lastSeen, locale) }) : t("admin.users.x.never")}</span>
              <Link href={`/admin/staff-activity/${s.id}`} className="text-sm font-semibold text-primary hover:underline">
                {t("admin.security.staff.open")} →
              </Link>
            </AdmCard>
          ))}
        </div>
      )}
    </div>
  );
}
