import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { FILTER_INPUT, FilterBar, pageNum, Pager, qs, StatusPill, str } from "@/components/admin/table-bits";
import { listUsers } from "@/lib/admin/users";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatBdMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.users.title"), robots: { index: false } };
}

const TONE = { active: "ok", suspended: "warn", banned: "bad" } as const;

// A-05 Users (BLUEPRINT §13.2).
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = { search: str(sp.q), role: str(sp.role), status: str(sp.status), page: pageNum(sp.page) };
  const [{ t, locale }, list] = await Promise.all([getI18n(), listUsers(q)]);
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.users.title")} lead={t("admin.users.lead", { n: String(list.total) })} />
      <FilterBar action="/admin/users">
        <input name="q" defaultValue={q.search} placeholder={t("admin.users.search")} className={`${FILTER_INPUT} min-w-56 flex-1`} />
        <select name="role" defaultValue={q.role} className={FILTER_INPUT} aria-label={t("admin.users.role")}>
          <option value="">{t("admin.users.allRoles")}</option>
          {(["client", "designer", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`admin.users.roles.${r}`)}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={q.status} className={FILTER_INPUT} aria-label={t("admin.users.status")}>
          <option value="">{t("admin.users.allStatuses")}</option>
          {(["active", "suspended", "banned"] as const).map((s) => (
            <option key={s} value={s}>
              {t(`admin.users.statuses.${s}`)}
            </option>
          ))}
        </select>
        <button className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t("admin.filter")}</button>
      </FilterBar>

      {list.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.users.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("admin.users.name")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.users.contact")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.users.role")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.users.status")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.users.strikes")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.users.joined")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.rows.map((u) => (
                <tr key={u.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink hover:text-primary">
                      {u.name}
                    </Link>
                    {u.username && <span className="block text-xs text-muted">@{u.username}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatBdMobile(u.mobile)}
                    {u.email && <span className="block text-xs">{u.email}</span>}
                  </td>
                  <td className="px-4 py-3">{t(`admin.users.roles.${u.role}`)}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={TONE[u.status]}>{t(`admin.users.statuses.${u.status}`)}</StatusPill>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {u.strikes}
                    {u.flagWarnings > 0 && <span className="ml-2 text-xs text-muted">{t("admin.users.warnings", { n: String(u.flagWarnings) })}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(u.createdAt, locale, "short")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={q.page}
        pages={list.pages}
        href={(p) => `/admin/users${qs({ q: q.search, role: q.role, status: q.status, page: p })}`}
        prev={t("admin.prev")}
        next={t("admin.next")}
        label={t("admin.pages")}
      />
    </div>
  );
}
