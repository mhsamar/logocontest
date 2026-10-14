import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHead } from "@/components/admin/page-head";
import { AuditTabs, deviceText, durationText, placeText, SessionStatus, whenText } from "@/components/admin/session-bits";
import { AdmCard, AdmEmpty } from "@/components/admin/ui";
import { superAdmin } from "@/lib/admin/core";
import { staffDetail } from "@/lib/admin/sessions";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.security.staff.title"), robots: { index: false } };
}

/** "payment.approve" → its label in the audit log, or the words. */
function actionLabel(t: (k: MessageKey) => string, action: string) {
  const key = `admin.audit.actions.${action.replace(/\./g, "_")}` as MessageKey;
  const label = t(key);
  return label === key ? action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()) : label;
}

const detailText = (c: Record<string, unknown>) =>
  Object.entries(c)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`.slice(0, 160))
    .join(" · ");

// One staff member (owner, 2026-10-14; Super admin only): every login and everything they did.
export default async function StaffMemberPage({ params }: PageProps<"/admin/staff-activity/[id]">) {
  const me = await superAdmin();
  if (!me) notFound();
  const { id } = await params;
  const [{ t, locale }, d] = await Promise.all([getI18n(), staffDetail(id)]);
  if (!d) notFound();
  const now = new Date();
  const worked = d.sessions.reduce((n, s) => n + s.activeSeconds, 0);
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={d.name} lead={[d.title, t("admin.security.staff.totals", { n: formatNumber(d.sessions.length, locale), time: durationText(worked, t, locale) })].filter(Boolean).join(" · ")} crumbs={[{ href: "/admin/staff-activity", label: t("admin.security.staff.title") }]} />
      <AuditTabs current="staff" t={t} staff />
      <div className="grid gap-4 xl:grid-cols-2">
        <AdmCard className="p-4">
          <h2 className="m-0 text-[17px] font-semibold">{t("admin.security.staff.sessions")}</h2>
          {d.sessions.length === 0 ? (
            <div className="mt-3">
              <AdmEmpty>{t("admin.security.noDevices")}</AdmEmpty>
            </div>
          ) : (
            <ul className="m-0 mt-2 list-none divide-y divide-adm-line-soft p-0">
              {d.sessions.map((s) => (
                <li key={s.id} className="flex flex-col gap-0.5 py-2.5 text-sm">
                  <span className="font-semibold text-ink">{t("admin.security.loggedIn", { when: whenText(s.createdAt, locale) })}</span>
                  <span className="text-ink">{deviceText(s, t)}</span>
                  <span className="text-muted">{[placeText(s, locale), s.ip].filter(Boolean).join(" · ") || t("admin.security.noPlace")}</span>
                  <span className="text-muted">{t("admin.security.staff.workedOne", { time: durationText(s.activeSeconds, t, locale) })}</span>
                  <SessionStatus r={s} t={t} locale={locale} now={now} />
                </li>
              ))}
            </ul>
          )}
        </AdmCard>
        <AdmCard className="p-4">
          <h2 className="m-0 text-[17px] font-semibold">{t("admin.security.staff.did")}</h2>
          {d.actions.length === 0 ? (
            <div className="mt-3">
              <AdmEmpty>{t("admin.audit.empty")}</AdmEmpty>
            </div>
          ) : (
            <ul className="m-0 mt-2 list-none divide-y divide-adm-line-soft p-0">
              {d.actions.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 py-2.5 text-sm">
                  <span className="font-semibold text-ink">{actionLabel(t, a.action)}</span>
                  <span className="text-muted">{whenText(a.createdAt, locale)}</span>
                  {detailText(a.changes) && <span className="break-words text-[13px] text-muted">{detailText(a.changes)}</span>}
                </li>
              ))}
            </ul>
          )}
        </AdmCard>
      </div>
    </div>
  );
}
