import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { FILTER_INPUT, FilterBar, pageNum, Pager, qs, str } from "@/components/admin/table-bits";
import { listAudit } from "@/lib/admin/misc";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.audit.title"), robots: { index: false } };
}

const LINKS: Record<string, (id: string) => string> = {
  user: (id) => `/admin/users/${id}`,
  designer_agreement: () => "/admin/agreements",
  copy_claim: () => "/admin/claims",
  report: () => "/admin/reports?view=closed",
  settings: () => "/admin/settings",
};

// A-12 Audit log (BLUEPRINT §13.12): read-only, newest first.
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  const q = { action: str(sp.action), page: pageNum(sp.page) };
  const [{ t, locale }, list] = await Promise.all([getI18n(), listAudit(q)]);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.audit.title")} lead={t("admin.audit.lead")} />
      <FilterBar action="/admin/audit">
        <select name="action" defaultValue={q.action} className={FILTER_INPUT} aria-label={t("admin.audit.action")}>
          <option value="">{t("admin.audit.allActions")}</option>
          {list.actions.map((a) => (
            <option key={a} value={a}>
              {t(`admin.audit.actions.${a}` as MessageKey)}
            </option>
          ))}
        </select>
        <button className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t("admin.filter")}</button>
      </FilterBar>
      {list.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.audit.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-line">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("admin.audit.when")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.audit.who")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.audit.action")}</th>
                <th className="px-4 py-3 font-semibold">{t("admin.audit.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {list.rows.map((r) => {
                const link = r.subjectId && LINKS[r.subjectType]?.(r.subjectId);
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{when(r.createdAt)}</td>
                    <td className="px-4 py-3">{r.admin ?? "—"}</td>
                    <td className="px-4 py-3">
                      {link ? (
                        <Link href={link} className="font-semibold text-ink hover:text-primary">
                          {t(`admin.audit.actions.${r.action}` as MessageKey)}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink">{t(`admin.audit.actions.${r.action}` as MessageKey)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="block max-w-xl whitespace-pre-wrap break-words font-mono text-xs text-muted">{Object.keys(r.changes).length ? JSON.stringify(r.changes) : "—"}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={q.page} pages={list.pages} href={(p) => `/admin/audit${qs({ action: q.action, page: p })}`} prev={t("admin.prev")} next={t("admin.next")} label={t("admin.pages")} />
    </div>
  );
}
