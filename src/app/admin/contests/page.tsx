import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { contestTone, FILTER_INPUT, FilterBar, pageNum, Pager, qs, StatusPill, str } from "@/components/admin/table-bits";
import { ADMIN_CONTEST_STATUSES, listAdminContests } from "@/lib/admin/contests";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.contests.title"), robots: { index: false } };
}

// A-02 Contests (BLUEPRINT §13.3).
export default async function AdminContestsPage({ searchParams }: PageProps<"/admin/contests">) {
  const sp = await searchParams;
  const q = { search: str(sp.q), status: str(sp.status), page: pageNum(sp.page) };
  const [{ t, locale }, list] = await Promise.all([getI18n(), listAdminContests(q)]);
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.contests.title")} lead={t("admin.contests.lead", { n: String(list.total) })} />
      <FilterBar action="/admin/contests">
        <input name="q" defaultValue={q.search} placeholder={t("admin.contests.search")} className={`${FILTER_INPUT} min-w-56 flex-1`} />
        <select name="status" defaultValue={q.status} className={FILTER_INPUT} aria-label={t("admin.contests.status")}>
          <option value="">{t("admin.contests.allLive")}</option>
          {ADMIN_CONTEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <button className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t("admin.filter")}</button>
      </FilterBar>
      {list.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.contests.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line">
          <table className="w-full min-w-[50rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("admin.contests.contest")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.contests.client")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.contests.status")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("admin.contests.prize")}</th>
                <th className="px-4 py-3 text-right font-semibold">{t("admin.contests.designs")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.contests.ends")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.rows.map((c) => (
                <tr key={c.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/contests/${c.slug}`} className="font-semibold text-ink hover:text-primary">
                      {c.brand}
                    </Link>
                    <span className="block text-xs text-muted">{c.number ? `#${String(c.number).padStart(5, "0")}` : c.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${c.client.id}`} className="text-ink hover:text-primary">
                      {c.client.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={contestTone(c.status)}>{t(`status.${c.status}` as never)}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatTaka(c.prize, locale)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.entries}</td>
                  <td className="px-4 py-3 text-muted">{c.endsAt ? formatDate(c.endsAt, locale, "short") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={q.page}
        pages={list.pages}
        href={(p) => `/admin/contests${qs({ q: q.search, status: q.status, page: p })}`}
        prev={t("admin.prev")}
        next={t("admin.next")}
        label={t("admin.pages")}
      />
    </div>
  );
}
