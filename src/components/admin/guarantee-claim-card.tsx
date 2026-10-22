import Link from "next/link";
import { GuaranteeDecide, GuaranteePay } from "@/components/admin/guarantee-decide";
import { AdmCard, formatId, IdChip, Pill } from "@/components/admin/ui";
import { formatUsdCents } from "@/lib/currency/rules";
import type { AdminClaim } from "@/lib/guarantee/queries";
import { refundAmountText, type RefundRoute } from "@/lib/guarantee/rules";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { showMobile } from "@/lib/payments/manual-rules";

/** A-27 Admin › Money-back claims (owner, 2026-10-21): one card per claim, with what to check and what to do next. */
export async function ClaimCards({ rows, viewer, canManage, repickDays }: { rows: AdminClaim[]; viewer: { id: string; isSuperAdmin: boolean }; canManage: boolean; repickDays: number }) {
  const { t, locale } = await getI18n();
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const full = (d: Date) => d.toLocaleString(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
  // Card refunds in the dollars Stripe charged, the rest in taka ("৳6,250 + $8.20").
  const money = (c: { amount: number; routes: RefundRoute[] }) => refundAmountText(c.routes, locale, c.amount);

  const routeText = (c: AdminClaim, r: RefundRoute) =>
    r.kind === "bkash"
      ? c.refundTo
        ? t("guarantee.admin.route.bkash", { amount: taka(r.taka), number: showMobile(c.refundTo) })
        : t("guarantee.admin.route.bkashNoNumber", { amount: taka(r.taka) })
      : r.kind === "stripe"
        ? t("guarantee.admin.route.stripe", { usd: formatUsdCents(r.usdCents, locale), intent: r.intent ?? r.txns[0] ?? "—" })
        : r.kind === "other"
          ? t("guarantee.admin.route.other", { amount: taka(r.taka), gateway: r.gateway, txn: r.txns[0] ?? "—" })
          : t("guarantee.admin.route.none", { amount: taka(r.taka) });
  const refLabel = (r: RefundRoute) => (r.kind === "bkash" ? t("guarantee.admin.refBkash") : r.kind === "stripe" ? t("guarantee.admin.refStripe", { intent: r.intent ?? "—" }) : t("guarantee.admin.refOther", { gateway: r.gateway }));

  const entryLine = (e: AdminClaim["entries"][number]) =>
    [
      e.status === "rejected" || (e.status === "withdrawn" && e.rejected) ? t("guarantee.admin.entry.rejected") : null,
      e.status === "held" ? t("guarantee.admin.entry.held") : null,
      e.status === "withdrawn" && e.withdrawnAt ? t("guarantee.admin.entry.withdrawn", { date: full(e.withdrawnAt) }) : null,
      e.status === "removed" ? t("guarantee.admin.entry.removed") : null,
      e.rating ? t("guarantee.admin.entry.stars", { n: num(e.rating) }) : null,
      e.shortlisted ? t("guarantee.admin.entry.shortlisted") : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      {rows.map((c) => {
        const number = c.number ? formatId("LC", c.number) : "—";
        const liked = c.entries.filter((e) => (e.rating ?? 0) >= 4 || e.shortlisted).length;
        // Someone else is sending it: only they finish it (the Super admin can take it over after checking with them).
        const lockedByOther = Boolean(c.payingById && c.payingById !== viewer.id && !viewer.isSuperAdmin);
        const warnings = [
          c.status === "pending" && c.held > 0 ? t("guarantee.admin.warnHeld", { count: num(c.held) }) : null,
          c.status === "pending" && c.openReports > 0 ? t("guarantee.admin.warnReports", { count: num(c.openReports) }) : null,
          ...(c.status === "pending" ? c.waitingPayments.map((w) => t("guarantee.admin.warnWaiting", { amount: taka(w.amount), txn: w.txn })) : []),
          ...c.sharedIp.map((names) => t("guarantee.admin.warnIp", { names: names.join(", ") })),
          c.chat.messages > 0 ? t("guarantee.admin.warnChat", { n: num(c.chat.messages), flagged: num(c.chat.flagged), files: num(c.chat.files) }) : null,
          liked > 0 ? t("guarantee.admin.warnLiked", { n: num(liked) }) : null,
          c.earlier > 0 ? t("guarantee.admin.warnEarlier", { n: num(c.earlier) }) : null,
          c.monthlyPrize ? t("guarantee.admin.warnPrize") : null,
          c.paidFrom && (c.status === "pending" || c.status === "approved") ? t("guarantee.admin.warnNumber", { number: showMobile(c.paidFrom) }) : null,
        ].filter((x): x is string => Boolean(x));
        const bkashTxns = c.routes.filter((r) => r.kind === "bkash").flatMap((r) => r.txns);
        return (
          <AdmCard key={c.id} as="article" className="flex flex-col gap-4 p-5" data-guarantee-claim={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <IdChip prefix="LC" n={c.number} />
                  {c.late && <Pill tone="warn">{t("guarantee.admin.late")}</Pill>}
                  {c.disputed && <Pill tone="sample">{t("guarantee.admin.disputed")}</Pill>}
                  {c.client?.isTest && <Pill tone="sample">{t("guarantee.admin.test")}</Pill>}
                </span>
                <strong className="text-[17px] text-ink">{c.brand}</strong>
                <span className="text-[14.5px] text-muted">
                  {c.client ? `${c.client.name}${c.client.mobile ? ` · ${showMobile(c.client.mobile)}` : ""}` : "—"} · {t("guarantee.admin.claimed", { date: full(c.createdAt) })}
                </span>
                {c.contest?.judgingEndsAt && c.status === "pending" && <span className="text-[14.5px] text-muted">{t("guarantee.admin.deadline", { date: full(c.contest.judgingEndsAt) })}</span>}
              </div>
              <strong className="lc-d text-[28px] font-semibold tracking-[-0.03em] text-primary tabular-nums">{money(c)}</strong>
            </div>

            <p className="m-0 text-[15px] text-ink">
              {t("guarantee.admin.count", { atClaim: num(c.atClaim), now: num(c.now), min: num(c.min) })}
              {c.atDecision !== null ? ` ${t("guarantee.admin.decidedCount", { n: num(c.atDecision) })}` : ""}
            </p>

            {warnings.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1.5 rounded-[12px] bg-adm-warn-bg p-3 text-[14px] text-adm-warn" data-warnings>
                {warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}

            {c.clientNote && (
              <p className="m-0 rounded-[12px] bg-[#f0f1f4] px-3.5 py-2.5 text-[14.5px] text-ink">
                <b>{t("guarantee.admin.clientNote")}:</b> {c.clientNote}
              </p>
            )}

            {c.entries.length > 0 && (
              <details className="text-[14.5px]">
                <summary className="cursor-pointer font-bold text-ink">
                  {t("guarantee.admin.entries")} ({num(c.entries.length)})
                </summary>
                <ul className="m-0 mt-2 flex list-none flex-col divide-y divide-adm-line p-0">
                  {c.entries.map((e) => (
                    <li key={e.number} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <b>#{num(e.number)}</b> {e.designer} <span className="text-muted">{entryLine(e)}</span>
                      </span>
                      <Pill tone={e.counted ? "good" : "neutral"}>{t(e.counted ? "guarantee.admin.entry.counted" : "guarantee.admin.entry.notCounted")}</Pill>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {c.excluded.length > 0 && (
              <p className="m-0 text-[14.5px] text-ink">
                {t("guarantee.admin.excluded", { list: c.excluded.map((x) => `${c.entries.find((e) => e.designerId === x.designer_id)?.designer ?? x.designer_id} (${x.reason})`).join(", ") })}
              </p>
            )}

            {(c.status === "pending" || c.status === "approved") && (
              <div className="flex flex-col gap-1.5 text-[14.5px]">
                <b className="text-ink">{t("guarantee.admin.money")}</b>
                {c.routes.map((r) => (
                  <span key={r.key}>• {routeText(c, r)}</span>
                ))}
                {bkashTxns.length > 0 && <span className="text-muted">{t("guarantee.admin.checkStatement", { txns: bkashTxns.join(", ") })}</span>}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap gap-3 text-[14.5px]">
                {c.contest && (
                  <Link href={`/admin/contests/${c.contest.slug}`} className="font-bold text-primary hover:underline">
                    {t("guarantee.admin.openContest")}
                  </Link>
                )}
                {!c.contest && <span className="text-muted">{t("guarantee.admin.gone")}</span>}
              </span>
              {c.status === "pending" && canManage && (
                <GuaranteeDecide
                  claimId={c.id}
                  number={number}
                  amount={money(c)}
                  min={c.min}
                  repickDays={repickDays}
                  canExclude={viewer.isSuperAdmin}
                  late={c.late}
                  counted={c.counted.map((id) => ({ label: c.entries.find((e) => e.designerId === id)?.designer ?? id, id }))}
                />
              )}
              {c.status === "approved" && (
                <span className="flex flex-col items-end gap-1.5 text-right text-sm">
                  <span className="text-muted">
                    {t("guarantee.admin.approved")}: {t("guarantee.admin.decidedBy", { name: c.decidedBy ?? "—", date: c.decidedAt ? full(c.decidedAt) : "" })}
                  </span>
                  {c.payingBy && c.payingSince && <Pill tone="warn">{t("guarantee.admin.paying", { name: c.payingBy, time: time(c.payingSince) })}</Pill>}
                  {canManage &&
                    (c.decidedById === viewer.id && !viewer.isSuperAdmin ? (
                      <span className="text-muted">{t("guarantee.admin.fourEyes")}</span>
                    ) : (
                      <GuaranteePay claimId={c.id} lockedByOther={lockedByOther} mine={c.payingById === viewer.id} routes={c.routes.filter((r) => r.kind !== "none").map((r) => ({ key: r.key, label: refLabel(r) }))} />
                    ))}
                </span>
              )}
              {(c.status === "refunded" || c.status === "rejected") && (
                <span className="flex flex-col items-end gap-0.5 text-right text-sm">
                  <Pill tone={c.status === "refunded" ? "good" : "bad"}>{t(c.status === "refunded" ? "guarantee.admin.refunded" : "guarantee.admin.rejected")}</Pill>
                  <span className="text-muted">{t("guarantee.admin.decidedBy", { name: c.decidedBy ?? "—", date: c.decidedAt ? full(c.decidedAt) : "" })}</span>
                  {c.refundedAt && <span className="text-muted">{t("guarantee.admin.refundedBy", { name: c.refundedBy ?? "—", date: full(c.refundedAt) })}</span>}
                  {Object.keys(c.refundRefs).length > 0 && <span className="font-mono text-ink">{t("guarantee.admin.refs", { refs: Object.values(c.refundRefs).join(", ") })}</span>}
                </span>
              )}
            </div>
            {c.reply && <p className="m-0 text-[14px] text-muted">{t("guarantee.admin.reply", { text: c.reply })}</p>}
            {c.internalNote && <p className="m-0 text-[14px] text-muted">{t("guarantee.admin.internal", { text: c.internalNote })}</p>}
          </AdmCard>
        );
      })}
    </>
  );
}
