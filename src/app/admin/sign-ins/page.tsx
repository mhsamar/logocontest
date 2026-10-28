import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { AdminHead } from "@/components/admin/page-head";
import { AuditTabs, deviceText, placeText, SessionStatus, whenText } from "@/components/admin/session-bits";
import { FILTER_INPUT, FilterBar, Pager, qs } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { signInQuery, signIns } from "@/lib/admin/sessions";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.security.signIns.title"), robots: { index: false } };
}

// Admin › Sign-ins (owner, 2026-10-14): every login with its device, browser, system, IP address and place.
export default async function AdminSignInsPage({ searchParams }: PageProps<"/admin/sign-ins">) {
  const me = await requirePermission("audit.view");
  const q = signInQuery(await searchParams);
  const [{ t, locale }, list] = await Promise.all([getI18n(), signIns(q)]);
  const now = new Date();
  const roleLabel = (r: string) => t(`admin.users.roles.${r}` as MessageKey);
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.security.signIns.title")} lead={t("admin.security.signIns.lead")} />
      <AuditTabs current="signins" t={t} staff={me.isSuperAdmin} />
      <FilterBar action="/admin/sign-ins">
        <input name="q" defaultValue={q.q} placeholder={t("admin.security.signIns.search")} aria-label={t("admin.security.signIns.search")} className={`${FILTER_INPUT} min-w-0 flex-[1_1_200px]`} />
        <select name="role" defaultValue={q.role} className={FILTER_INPUT} aria-label={t("admin.security.signIns.role")}>
          {(["all", "client", "designer", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {r === "all" ? t("admin.security.signIns.everyone") : roleLabel(r)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={q.status} className={FILTER_INPUT} aria-label={t("admin.security.signIns.statusLabel")}>
          {(["all", "open", "ended"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`admin.security.signIns.status.${s}`)}
            </option>
          ))}
        </select>
        <button className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t("admin.filter")}</button>
      </FilterBar>
      <p className="m-0 text-sm text-muted">{t("admin.security.signIns.count", { n: formatNumber(list.total, locale) })}</p>
      {list.rows.length === 0 ? (
        <AdmEmpty>{t("admin.security.signIns.empty")}</AdmEmpty>
      ) : (
        <AdmCard className="p-2 sm:p-3">
          <ul className="m-0 list-none divide-y divide-adm-line-soft p-0">
            {list.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 px-2 py-3">
                <div className="min-w-0 flex-[1_1_240px]">
                  {r.user ? (
                    <Link href={`/admin/users/${r.user.id}`} className="font-semibold text-ink hover:text-primary">
                      {r.user.name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">—</span>
                  )}
                  {r.user && (
                    <span className="ml-1.5 text-sm text-muted">
                      {r.user.username ? `@${r.user.username} · ` : ""}
                      {roleLabel(r.user.role)}
                    </span>
                  )}
                  <span className="block text-sm text-ink">{deviceText(r, t)}</span>
                  <span className="block text-sm text-muted">
                    {[placeText(r, locale), r.ip].filter(Boolean).join(" · ") || t("admin.security.noPlace")}
                  </span>
                  {r.impersonatedBy && (
                    <span className="mt-1 inline-block">
                      <Pill tone="sample">{t("admin.security.openedBy", { name: r.impersonatedBy })}</Pill>
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 text-sm sm:items-end">
                  <span className="text-ink">{t("admin.security.loggedIn", { when: whenText(r.createdAt, locale) })}</span>
                  <SessionStatus r={r} t={t} locale={locale} now={now} />
                </div>
              </li>
            ))}
          </ul>
        </AdmCard>
      )}
      <Pager page={q.page} pages={list.pages} href={(p) => `/admin/sign-ins${qs({ q: q.q, role: q.role === "all" ? undefined : q.role, status: q.status === "all" ? undefined : q.status, page: p })}`} prev={t("admin.prev")} next={t("admin.next")} label={t("admin.pages")} />
    </div>
  );
}
