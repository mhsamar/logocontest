import type { Metadata } from "next";
import { DesignLink } from "@/components/admin/design-viewer";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/icons";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin/admin-action";
import { contestTone, StatusPill } from "@/components/admin/table-bits";
import { cancelContest, extendContest, forceAward } from "@/lib/admin/contest-actions";
import { getAdminContest } from "@/lib/admin/contests";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.contests.title"), robots: { index: false } };
}

// A-02 Contest detail: summary, designs, payments; Edit brief, Extend, Force-award, Cancel.
export default async function AdminContestPage({ params }: PageProps<"/admin/contests/[slug]">) {
  await requirePermission("contests.view");
  const { slug } = await params;
  const [{ t, locale }, c] = await Promise.all([getI18n(), getAdminContest(slug)]);
  if (!c) notFound();
  const taka = (n: number) => formatTaka(n, locale);
  const when = (d: Date | null) => (d ? d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "—");
  const active = c.entriesList.filter((e) => e.status === "active");
  const canAward = (c.status === "open" || c.status === "judging") && active.length > 0;
  const canCancel = !["completed", "no_result", "cancelled"].includes(c.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/contests" className="text-sm font-semibold text-primary hover:underline">
          ← {t("admin.contests.title")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{c.brand}</h1>
          <StatusPill tone={contestTone(c.status)}>{t(`status.${c.status}` as MessageKey)}</StatusPill>
          {c.number && <span className="font-mono text-sm text-muted">#{String(c.number).padStart(5, "0")}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {t("admin.contests.byClient")}{" "}
          <Link href={`/admin/users/${c.client.id}`} className="font-semibold text-ink hover:text-primary">
            {c.client.name}
          </Link>
          {" · "}
          <a href={`/contest/${c.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
            {t("admin.contests.publicPage")}
            <AdminIcon name="external" size={14} />
          </a>
          {" · "}
          <a href={`/dashboard/contests/${c.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
            {t("admin.contests.clientView")}
            <AdminIcon name="external" size={14} />
          </a>
        </p>
        {c.cancelReason && <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{t("admin.contests.cancelledBecause", { reason: c.cancelReason })}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {c.status === "open" && (
          <Link href={`/dashboard/contests/${c.slug}/edit`} className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-[0.9375rem] font-semibold text-ink ring-1 ring-inset ring-line hover:bg-canvas">
            {t("admin.contests.editBrief")}
          </Link>
        )}
        {c.status === "open" && (
          <AdminAction
            label={t("admin.contests.extend")}
            body={t("admin.contests.extendBody")}
            fields={[
              { name: "days", kind: "number", label: t("admin.contests.extendDays"), min: 1, max: 30, defaultValue: "3" },
              { name: "reason", kind: "reason" },
            ]}
            run={extendContest.bind(null, c.id)}
          />
        )}
        {canAward && (
          <AdminAction
            label={t("admin.contests.forceAward")}
            body={t("admin.contests.forceAwardBody")}
            fields={[
              {
                name: "entry",
                kind: "select",
                label: t("admin.contests.winningDesign"),
                options: active.map((e) => ({ value: e.id, label: `#${e.number} · ${e.designer.username ? `@${e.designer.username}` : e.designer.name}${e.rating ? ` · ${"★".repeat(e.rating)}` : ""}` })),
              },
              { name: "reason", kind: "reason" },
            ]}
            run={forceAward.bind(null, c.id)}
          />
        )}
        {canCancel && <AdminAction label={t("admin.contests.cancel")} body={t("admin.contests.cancelBody")} tone="danger" run={cancelContest.bind(null, c.id)} />}
      </div>

      <dl className="grid gap-3 rounded-2xl bg-surface p-5 text-sm shadow-card ring-1 ring-line sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("admin.contests.prize"), taka(c.prize)],
          [t("admin.contests.paid"), `${taka(c.total)} (${t("admin.contests.feeAddons", { fee: taka(c.serviceFee), addons: taka(c.upgrades) })})`],
          [t("admin.contests.started"), when(c.startsAt)],
          [t("admin.contests.ends"), when(c.endsAt)],
          [t("admin.contests.judgingEnds"), when(c.judgingEndsAt)],
          [t("admin.contests.length"), t("admin.contests.lengthValue", { days: String(c.durationDays), ext: String(c.extensions) })],
          [t("admin.contests.addons"), c.flags.length ? c.flags.map((f) => t(`admin.contests.flags.${f}` as MessageKey)).join(", ") : "—"],
          [t("admin.contests.handover"), c.handover ? `${t(`admin.claims.handover.${c.handover.status}` as MessageKey)} · ${c.handover.designer}` : "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <h2 className="font-semibold text-ink">
            {t("admin.contests.designs")} <span className="text-muted">({c.entriesList.length})</span>
          </h2>
          {c.entriesList.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("admin.users.none")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {c.entriesList.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <DesignLink entryId={e.id} className="font-semibold text-ink hover:text-primary">
                      #{e.number}
                    </DesignLink>{" "}
                    <Link href={`/admin/users/${e.designer.id}`} className="text-muted hover:text-primary">
                      {e.designer.username ? `@${e.designer.username}` : e.designer.name}
                    </Link>
                  </span>
                  <span className="text-xs text-muted">
                    {e.rating ? `${"★".repeat(e.rating)} · ` : ""}
                    {t(`admin.entries.statuses.${e.status}` as MessageKey)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <h2 className="font-semibold text-ink">{t("admin.payments.title")}</h2>
          {c.payments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("admin.users.none")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {c.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-ink">
                    {t(`admin.payments.purposes.${p.purpose}` as MessageKey)} · <b className="tabular-nums">{taka(p.amount)}</b>
                    <span className="block text-xs text-muted">
                      {p.gateway}
                      {p.txnId && ` · ${p.txnId}`} · {formatDate(p.paidAt ?? p.createdAt, locale, "short")}
                    </span>
                  </span>
                  <StatusPill tone={p.status === "paid" ? "ok" : p.status === "failed" ? "bad" : "muted"}>{t(`admin.payments.statuses.${p.status}` as MessageKey)}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
