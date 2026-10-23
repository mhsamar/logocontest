import type { Metadata } from "next";
import Link from "next/link";
import { BarRow } from "@/components/admin/charts";
import { AdminAction } from "@/components/admin/admin-action";
import { CopyLink } from "@/components/admin/copy-link";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { QuickDelete } from "@/components/admin/quick-delete";
import { AdmCard, AdmEmpty, isNewSince, KpiGrid, KpiTile, NewPill, Pill } from "@/components/admin/ui";
import { SeenNow } from "@/components/admin/admin-nav";
import { sectionVisit } from "@/lib/admin/badges";
import { dhakaStart, unpaidContests, type UnpaidContest } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { dashboardStats } from "@/lib/admin/dashboard";
import { wizardLeads } from "@/lib/admin/leads";
import { hasPermission } from "@/lib/admin/permissions";
import { addUnpaidNote } from "@/lib/admin/unpaid-actions";
import { UNPAID_OUTCOMES, unpaidNotes } from "@/lib/admin/unpaid-notes";
import { cx } from "@/lib/cx";
import { linkOrigin } from "@/lib/site-origin";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { formatMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.unpaid.title"), robots: { index: false } };
}

/** The wizard's 8 steps (owner, 2026-10-15), then "went to payment" (9) and "paid" (10), as on the Dashboard. */
const STEPS = 10;
const AT_PAYMENT = 9;
const REVIEW = 8;
/** "Where clients stop": the steps the design shows. */
const FUNNEL_STEPS = [1, 2, 7, 8, 9, 10];
const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

// A-22 Unpaid contests (BLUEPRINT §13.2 item 4; design/admin/unpaid-contests.html, owner 2026-10-10): started but not
// paid, where each client stopped, what they filled in, and Call, Message and the payment link.
export default async function AdminUnpaidPage() {
  const me = await requirePermission("unpaid.view");
  const canMessage = hasPermission(me, "messages.manage");
  // Call notes and Delete (owner, 2026-10-20): Unpaid contests · manage.
  const canManage = hasPermission(me, "unpaid.manage");
  const [{ t, locale }, rows, stats, origin, leads, visit] = await Promise.all([
    getI18n(),
    unpaidContests(),
    dashboardStats({ since: dhakaStart(29), until: null }),
    linkOrigin(),
    wizardLeads(),
    // Contests and leads that came in since this admin last opened Unpaid get a "New" tag (owner, 2026-10-23).
    sectionVisit(me, "unpaid"),
  ]);
  const notes = await unpaidNotes(rows.map((r) => r.id));
  // A contest waiting for payment reached the payment page, even when the wizard didn't record the step.
  const stepOf = (r: UnpaidContest) => r.step ?? (r.status === "pending_payment" ? AT_PAYMENT : null);
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const now = new Date();
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
  const when = (d: Date) => (dhakaDay(d) === dhakaDay(now) ? `${t("admin.analytics.today")}, ${time(d)}` : d.toLocaleString(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }));
  const stepName = (n: number) => t(`admin.dashboard.steps.s${n}` as MessageKey);

  const waiting = rows.reduce((a, r) => a + r.amount, 0);
  const atPayment = rows.filter((r) => (stepOf(r) ?? 0) >= AT_PAYMENT).length;
  const longest = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const funnelTop = Math.max(1, stats?.funnel[0]?.visits ?? 0);

  const advice = (r: UnpaidContest) => {
    const step = stepOf(r) ?? 0;
    if (!step) return { title: t("admin.unpaid.next.message"), body: t("admin.unpaid.next.unknownBody", { brand: r.brand || "—" }) };
    if (step >= AT_PAYMENT) return { title: t("admin.unpaid.next.call"), body: t("admin.unpaid.next.callBody", { brand: r.brand || "—" }) };
    if (step === REVIEW) return { title: t("admin.unpaid.next.message"), body: t("admin.unpaid.next.reviewBody", { brand: r.brand || "—" }) };
    return { title: t("admin.unpaid.next.message"), body: t("admin.unpaid.next.stepBody", { brand: r.brand || "—", step: step ? stepName(step) : "—" }) };
  };

  const filled = (r: UnpaidContest): [string, string][] => [
    [t("admin.dashboard.steps.s2"), r.brand || "—"],
    [t("admin.dashboard.steps.s3"), r.brief.businessType ? t(`wizard.businessTypes.${r.brief.businessType}` as MessageKey) : "—"],
    [t("wizard.c11.recap.website"), r.brief.website || t("admin.unpaid.none_")],
    [t("wizard.c11.recap.styles"), r.brief.styles.length ? r.brief.styles.map((s) => t(`wizard.styles.${s}` as MessageKey)).join(", ") : "—"],
    [t("wizard.c11.recap.colours"), r.brief.letDesignersChoose ? t("admin.unpaid.designersChoose") : r.brief.colors.length ? r.brief.colors.join(" ") : "—"],
    [t("wizard.c11.files"), num(r.brief.files)],
    [t("admin.unpaid.prizeAddons"), r.brief.prize ? `${taka(r.brief.prize)}${r.brief.addons ? ` + ${taka(r.brief.addons)}` : ""}` : "—"],
  ];

  return (
    <div className="flex flex-col gap-5">
      {visit.at && <SeenNow section="unpaid" at={visit.at} />}
      <AdminHead title={t("admin.unpaid.title")} lead={t("admin.unpaid.leadNew")} />

      <KpiGrid>
        <KpiTile label={t("admin.unpaid.title")} value={num(rows.length)} hint={t("admin.unpaid.kpi.startedHint")} icon="unpaid" />
        <KpiTile label={t("admin.unpaid.kpi.money")} value={taka(waiting)} hint={t("admin.unpaid.kpi.moneyHint")} icon="payments" accent />
        <KpiTile label={t("admin.unpaid.kpi.atPayment")} value={num(atPayment)} hint={t("admin.unpaid.kpi.atPaymentHint")} icon="revenue" />
        <KpiTile label={t("admin.unpaid.kpi.longest")} value={longest ? longest.brand || "—" : "—"} hint={longest ? t("admin.unpaid.kpi.since", { when: when(longest.createdAt) }) : undefined} icon="calendar" />
      </KpiGrid>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          {rows.length === 0 ? (
            <AdmCard className="p-5">
              <AdmEmpty>{t("admin.unpaid.none")}</AdmEmpty>
            </AdmCard>
          ) : (
            rows.map((r) => {
              const step = stepOf(r) ?? 0;
              const a = advice(r);
              const said = notes?.get(r.id) ?? [];
              const payLink = `${origin}/start?draft=${r.id}&step=11`;
              return (
                <AdmCard key={r.id} as="article" className="flex flex-col gap-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start gap-3.5">
                    <span className="lc-d flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-tint text-[21px] font-semibold text-primary">{(r.brand || "?").trim().slice(0, 1).toUpperCase()}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/admin/contests/${r.slug}`} className="lc-d text-xl font-semibold tracking-[-0.02em] hover:text-primary">
                          {r.brand || "—"}
                        </Link>
                        {isNewSince(r.createdAt, visit.since) && <NewPill label={t("admin.whatsNew.tag")} />}
                        <Pill>{t(`admin.unpaid.statuses.${r.status}`)}</Pill>
                        {step >= AT_PAYMENT && <Pill tone="warn">{t("admin.unpaid.stoppedAtPayment")}</Pill>}
                      </div>
                      <span className="text-[15px] text-muted">
                        {t("admin.unpaid.clientLabel")}{" "}
                        {r.client ? (
                          <Link href={`/admin/users/${r.client.id}`} className="font-semibold text-ink hover:text-primary">
                            {r.client.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {r.client?.created_at && ` · ${t("admin.unpaid.signedUp", { when: when(new Date(r.client.created_at)) })}`}
                      </span>
                      {r.client?.mobile && <span className="font-mono text-[14.5px] text-adm-strong">{formatMobile(r.client.mobile)}</span>}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[13.5px] text-muted">{t("admin.unpaid.amountToPay")}</span>
                      <strong className="lc-d text-2xl font-semibold tracking-[-0.02em] text-primary">{taka(r.amount)}</strong>
                      <span className="text-[13.5px] text-muted">{t("admin.unpaid.startedOn", { when: when(r.createdAt) })}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <span className="text-sm font-bold text-muted">
                      {t("admin.unpaid.whereStopped")}{" "}
                      {step > 0 && (
                        <span className="font-semibold text-ink">
                          {t("admin.unpaid.stepOfAll", { n: num(step), all: num(STEPS) })} <span className="font-medium text-muted">· {t("admin.unpaid.finished", { n: num(Math.max(0, step - 1)) })}</span>
                        </span>
                      )}
                    </span>
                    <ol className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5 p-0">
                      {Array.from({ length: STEPS }, (_, i) => i + 1).map((n) => {
                        const state = n < step ? "done" : n === step ? "here" : "todo";
                        return (
                          <li key={n} className={cx("flex flex-col gap-1 rounded-[10px] px-2 py-1.5 text-[12.5px]", state === "done" ? "bg-adm-good-bg text-adm-good" : state === "here" ? "bg-adm-warn-bg font-bold text-adm-warn ring-1 ring-adm-warn/30" : "bg-adm-bg text-muted")}>
                            <span className="font-bold tabular-nums">{num(n)}</span>
                            <span className="truncate" title={stepName(n)}>
                              {stepName(n)}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <details open className="group rounded-[12px] bg-adm-bg px-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[15px] font-bold">
                      {t("admin.unpaid.filled")}
                      <AdminIcon name="chevron" size={16} className="transition-transform group-open:rotate-90" />
                    </summary>
                    <dl className="m-0 grid gap-x-6 gap-y-2 pb-4 text-[15px] sm:grid-cols-2">
                      {filled(r).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 border-b border-adm-line-soft pb-2">
                          <dt className="text-muted">{k}</dt>
                          <dd className="m-0 min-w-0 truncate text-right font-semibold">{v}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 sm:col-span-2">
                        <dt className="font-bold">{t("admin.unpaid.total")}</dt>
                        <dd className="m-0 font-bold text-primary">{taka(r.amount)}</dd>
                      </div>
                    </dl>
                  </details>

                  <div className="flex flex-wrap gap-2">
                    {r.client?.mobile && (
                      <a href={`tel:${r.client.mobile}`} className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-primary px-4 text-[15px] font-bold text-white hover:bg-adm-deep">
                        {t("admin.unpaid.callNow")}
                      </a>
                    )}
                    {canMessage && r.client && (
                      <Link href={`/admin/messages?to=${r.client.id}`} className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-adm-line bg-surface px-4 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
                        <AdminIcon name="messages" size={16} />
                        {t("admin.unpaid.message")}
                      </Link>
                    )}
                    <CopyLink value={payLink} label={t("admin.unpaid.copyLink")} done={t("admin.unpaid.copied")} />
                    {canManage && (
                      <AdminAction
                        label={t("admin.unpaid.notes.button")}
                        title={t("admin.unpaid.notes.title")}
                        body={t("admin.unpaid.notes.body")}
                        done={t("admin.unpaid.notes.saved")}
                        fields={[
                          { name: "outcome", kind: "select", label: t("admin.unpaid.notes.outcomeLabel"), options: UNPAID_OUTCOMES.map((o) => ({ value: o, label: t(`admin.unpaid.notes.outcomes.${o}`) })) },
                          { name: "note", kind: "text", label: t("admin.unpaid.notes.noteLabel"), hint: t("admin.unpaid.notes.noteHint") },
                        ]}
                        run={addUnpaidNote.bind(null, r.id)}
                      />
                    )}
                    {canManage && <QuickDelete kind="unpaid" id={r.id} name={r.brand || "—"} label={t("admin.unpaid.notes.delete")} />}
                  </div>

                  {/* What the client said, newest first (owner, 2026-10-20). */}
                  {said.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-[12px] border border-adm-line-soft p-3.5" data-unpaid-notes>
                      <span className="text-sm font-bold text-muted">{t("admin.unpaid.notes.history")}</span>
                      {said[0].outcome === "mistake" && canManage && <span className="text-[14px] font-semibold text-[#A3121B]">{t("admin.unpaid.notes.mistakeHint")}</span>}
                      <ul className="m-0 flex list-none flex-col gap-2 p-0">
                        {said.slice(0, 4).map((n) => (
                          <li key={n.id} className="flex flex-col gap-0.5">
                            <span className="flex flex-wrap items-center gap-2">
                              <Pill tone={n.outcome === "later" || n.outcome === "help" ? "warn" : n.outcome === "mistake" || n.outcome === "not_interested" ? "bad" : "neutral"}>{t(`admin.unpaid.notes.outcomes.${n.outcome}`)}</Pill>
                              <span className="text-[13px] text-muted">{t("admin.unpaid.notes.by", { name: n.by ?? "—", when: when(n.at) })}</span>
                            </span>
                            {n.note && <span className="text-[14.5px] text-ink">{n.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-3 rounded-[12px] bg-adm-sample-bg p-3.5 text-adm-sample">
                    <AdminIcon name="revenue" className="mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <strong className="text-[15px]">{a.title}</strong>
                      <span className="text-[14.5px]">{a.body}</span>
                    </div>
                  </div>
                </AdmCard>
              );
            })
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 xl:sticky xl:top-[92px]">
        {/* New clients who left their mobile number on the first step (owner, 2026-10-14). */}
        <AdmCard as="section" className="flex min-w-0 flex-col gap-3 p-5 sm:p-6" data-wizard-leads>
          <div>
            <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.leads.title")}</h2>
            <p className="m-0 mt-1 text-[14.5px] text-muted">{t("admin.unpaid.leads.lead")}</p>
          </div>
          {leads.length === 0 ? (
            <p className="m-0 text-[15px] text-muted">{t("admin.unpaid.leads.empty")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-adm-line p-0">
              {leads.map((l) => (
                <li key={l.mobile} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-[15px]">{l.brand || "—"}</strong>
                      {isNewSince(l.createdAt, visit.since) && <NewPill label={t("admin.whatsNew.tag")} />}
                    </span>
                    <span className="text-[13.5px] text-muted">
                      {formatMobile(l.mobile)} · {t("admin.unpaid.leads.stopped", { step: stepName(Math.min(l.step, STEPS)) })} · {when(l.updatedAt)}
                    </span>
                  </span>
                  <a href={`tel:${l.mobile}`} className="inline-flex min-h-10 shrink-0 items-center rounded-[10px] border border-adm-line px-3 text-[14px] font-bold text-primary hover:border-primary">
                    {t("admin.unpaid.leads.call")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </AdmCard>
        <AdmCard as="aside" className="flex min-w-0 flex-col gap-3.5 p-5 sm:p-6">
          <div>
            <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.whereStop")}</h2>
            <p className="m-0 mt-1 text-[14.5px] text-muted">{t("admin.unpaid.whereStopLead")}</p>
          </div>
          {!stats || (stats.funnel[0]?.visits ?? 0) === 0 ? (
            <p className="m-0 text-[15px] text-muted">{t("admin.dashboard.funnelEmpty")}</p>
          ) : (
            FUNNEL_STEPS.map((n) => {
              const f = stats.funnel.find((x) => x.step === n);
              return <BarRow key={n} label={stepName(n)} n={f?.visits ?? 0} of={funnelTop} max={funnelTop} num={num} labelWidth="w-[118px]" />;
            })
          )}
          {hasPermission(me, "dashboard.view") && (
            <Link href="/admin" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
              {t("admin.unpaid.allSteps", { n: num(STEPS) })}
              <AdminIcon name="arrow" size={16} />
            </Link>
          )}
        </AdmCard>
        </div>
      </div>
    </div>
  );
}
