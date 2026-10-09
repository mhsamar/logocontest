import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { EntryThumb } from "@/components/admin/entry-thumb";
import { AdminHead } from "@/components/admin/page-head";
import { StatusPill } from "@/components/admin/table-bits";
import { cx } from "@/lib/cx";
import { listReports } from "@/lib/admin/moderation";
import { resolveReport } from "@/lib/admin/moderation-actions";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.reports.title"), robots: { index: false } };
}

// A-04 Reports (BLUEPRINT §10, §13.5): the design, the reason, evidence image and links side by side.
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePermission("reports.view");
  const sp = await searchParams;
  const view = sp.view === "closed" ? "closed" : "open";
  const [{ t, locale }, reports] = await Promise.all([getI18n(), listReports(view)]);
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.reports.title")} lead={t("admin.reports.lead")} />
      <div className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line sm:w-fit">
        {(["open", "closed"] as const).map((v) => (
          <Link key={v} href={v === "open" ? "/admin/reports" : "/admin/reports?view=closed"} className={cx("inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold", view === v ? "bg-ink text-white" : "text-ink hover:bg-canvas")}>
            {t(`admin.reports.views.${v}`)}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t(`admin.reports.empty.${view}`)}</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => {
            const copyOrAi = r.reason === "copied" || r.reason === "ai";
            return (
              <li key={r.id} className="grid gap-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line md:grid-cols-[10rem_10rem_minmax(0,1fr)] xl:grid-cols-[10rem_10rem_minmax(0,1fr)_15rem]">
                <EntryThumb entry={r.entry} />
                <div>
                  {r.evidenceUrl ? (
                    <a href={r.evidenceUrl} target="_blank" rel="noopener noreferrer" className="block overflow-clip rounded-xl ring-1 ring-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.evidenceUrl} alt={t("admin.reports.evidence")} className="aspect-square w-full object-cover" />
                    </a>
                  ) : (
                    <span className="flex aspect-square items-center justify-center rounded-xl bg-canvas px-2 text-center text-xs text-muted ring-1 ring-line">{t("admin.reports.noEvidence")}</span>
                  )}
                  <p className="mt-1.5 text-xs text-muted">{t("admin.reports.evidence")}</p>
                </div>
                <div className="min-w-0 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={copyOrAi ? "bad" : "warn"}>{t(`admin.reports.reasons.${r.reason}` as MessageKey)}</StatusPill>
                    {view === "closed" && <StatusPill tone="muted">{t(`admin.reports.statuses.${r.status}` as MessageKey)}</StatusPill>}
                  </div>
                  <p className="text-muted">
                    {t("admin.reports.by")}{" "}
                    <Link href={`/admin/users/${r.reporter.id}`} className="font-semibold text-ink hover:text-primary">
                      {r.reporter.username ? `@${r.reporter.username}` : r.reporter.name}
                    </Link>{" "}
                    ({t(`admin.users.roles.${r.reporter.role}` as MessageKey)}){r.reporter.warnings > 0 && <> · {t("admin.users.warnings", { n: String(r.reporter.warnings) })}</>} · {formatDate(r.createdAt, locale, "short")}
                  </p>
                  {r.note && <p className="whitespace-pre-line rounded-xl bg-canvas p-3 text-ink">{r.note}</p>}
                  {r.links.length > 0 && (
                    <ul className="space-y-1">
                      {r.links.map((l) => (
                        <li key={l}>
                          <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-primary hover:underline">
                            {l}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {view === "open" && (
                  <div className="flex flex-col gap-2 md:col-span-3 md:flex-row xl:col-span-1 xl:flex-col">
                    <AdminAction
                      label={t("admin.reports.uphold")}
                      body={t("admin.reports.upholdBody")}
                      tone="danger"
                      fields={[
                        {
                          name: "action",
                          kind: "select",
                          label: t("admin.reports.action"),
                          defaultValue: copyOrAi ? "ban" : "strike",
                          options: (["ban", "strike", "none"] as const).map((a) => ({ value: a, label: t(`admin.reports.actions.${a}`) })),
                        },
                        { name: "reason", kind: "reason" },
                      ]}
                      run={resolveReport.bind(null, r.id, "upheld")}
                    />
                    <AdminAction label={t("admin.reports.dismiss")} run={resolveReport.bind(null, r.id, "dismissed")} />
                    <AdminAction label={t("admin.reports.dismissFalse")} body={t("admin.reports.dismissFalseBody")} tone="ghost" run={resolveReport.bind(null, r.id, "dismissed_false")} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
