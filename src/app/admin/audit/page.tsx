import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { AuditTabs } from "@/components/admin/session-bits";
import { FILTER_INPUT, FilterBar, pageNum, Pager, qs, str } from "@/components/admin/table-bits";
import { isNewSince, NewPill } from "@/components/admin/ui";
import { SeenNow } from "@/components/admin/admin-nav";
import { sectionVisit } from "@/lib/admin/badges";
import { listAudit } from "@/lib/admin/misc";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { requirePermission } from "@/lib/admin/core";
import { PRICING_KEYS } from "@/lib/admin/pricing-keys";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.audit.title"), robots: { index: false } };
}

const LINKS: Record<string, (id: string, changes: Record<string, unknown>) => string> = {
  user: (id) => `/admin/users/${id}`,
  designer_agreement: () => "/admin/agreements",
  copy_claim: () => "/admin/claims",
  guarantee_claim: () => "/admin/refunds?tab=refunded",
  report: () => "/admin/reports?view=closed",
  // Prices and fees are saved from Admin › Pricing & fees (owner, 2026-10-22).
  // Prices and fees are saved on Admin › Pricing & fees (owner, 2026-10-22); the rest on Settings.
  settings: (_, c) => (Object.keys((c.changes as Record<string, unknown> | undefined) ?? {}).some((k) => PRICING_KEYS.has(k)) ? "/admin/pricing" : "/admin/settings"),
  contest_service: () => "/admin/services",
};

/** Changes that record old → new (settings, services) as one line each; anything else as JSON. */
function changeText(c: Record<string, unknown>): string {
  const v = (x: unknown) => (x === null || x === undefined ? "—" : typeof x === "string" ? x : JSON.stringify(x)).slice(0, 160);
  const line = (key: string, x: unknown) => (x && typeof x === "object" && "to" in x ? `${key}: ${v((x as { from?: unknown }).from)} → ${v((x as { to: unknown }).to)}` : `${key}: ${v(x)}`);
  if ("from" in c && "to" in c) return line(String(c.field ?? "value"), c);
  if (typeof c.on === "boolean") return `is_live: ${c.on ? "on" : "off"}`;
  if (c.changes && typeof c.changes === "object") {
    const lines = Object.entries(c.changes as Record<string, unknown>).map(([k, x]) => line(k, x));
    return [...lines, ...(c.reason ? [`reason: ${v(c.reason)}`] : [])].join("\n") || "—";
  }
  // Anything else one "key: value" per line (owner, 2026-10-14: no raw JSON).
  return Object.keys(c).length ? Object.entries(c).map(([k, x]) => line(k, x)).join("\n") : "—";
}

/** "payment.approve" → the label under admin.audit.actions.payment_approve; an action without one reads as words. */
function actionLabel(t: (key: MessageKey) => string, action: string): string {
  const key = `admin.audit.actions.${action.replace(/\./g, "_")}` as MessageKey;
  const label = t(key);
  return label === key ? action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase()) : label;
}

// A-12 Audit log (BLUEPRINT §13.12): read-only, newest first.
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const me = await requirePermission("audit.view");
  const sp = await searchParams;
  // What the rest of the team did since this admin last looked: "New" tag, and a filter for just that (owner, 2026-10-23).
  const visit = await sectionVisit(me, "audit");
  const onlyNew = str(sp.new) === "1" && Boolean(visit.since);
  const q = { action: str(sp.action), page: pageNum(sp.page), fresh: onlyNew && visit.since ? { since: visit.since, notBy: me.id } : null };
  const [{ t, locale }, list] = await Promise.all([getI18n(), listAudit(q)]);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="space-y-4">
      {visit.at && <SeenNow section="audit" at={visit.at} />}
      <AdminHead title={t("admin.audit.title")} lead={t("admin.audit.lead")} />
      <AuditTabs current="actions" t={t} staff={me.isSuperAdmin} />
      <FilterBar action="/admin/audit">
        <select name="action" defaultValue={q.action} className={FILTER_INPUT} aria-label={t("admin.audit.action")}>
          <option value="">{t("admin.audit.allActions")}</option>
          {list.actions.map((a) => (
            <option key={a} value={a}>
              {actionLabel(t, a)}
            </option>
          ))}
        </select>
        {visit.since && (
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" name="new" value="1" defaultChecked={onlyNew} className="size-4 accent-primary" />
            {t("admin.whatsNew.teamOnly")}
          </label>
        )}
        <button className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">{t("admin.filter")}</button>
      </FilterBar>
      {list.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t(onlyNew ? "admin.whatsNew.teamNone" : "admin.audit.empty")}</p>
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
                const link = r.subjectId && LINKS[r.subjectType]?.(r.subjectId, (r.changes ?? {}) as Record<string, unknown>);
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {when(r.createdAt)}
                      {r.adminId && r.adminId !== me.id && isNewSince(r.createdAt, visit.since) && <NewPill label={t("admin.whatsNew.tag")} className="ml-2" />}
                    </td>
                    <td className="px-4 py-3">{r.admin ?? "—"}</td>
                    <td className="px-4 py-3">
                      {link ? (
                        <Link href={link} className="font-semibold text-ink hover:text-primary">
                          {actionLabel(t, r.action)}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink">{actionLabel(t, r.action)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="block max-w-xl whitespace-pre-wrap break-words font-mono text-xs text-muted">{r.subjectType === "contest_service" && r.subjectId ? `${r.subjectId} · ` : ""}
                        {changeText(r.changes)}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={q.page} pages={list.pages} href={(p) => `/admin/audit${qs({ action: q.action, new: onlyNew ? "1" : undefined, page: p })}`} prev={t("admin.prev")} next={t("admin.next")} label={t("admin.pages")} />
    </div>
  );
}
