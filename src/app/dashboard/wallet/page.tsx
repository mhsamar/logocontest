import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { SmallPageHeader } from "@/components/ui/section-heading";
import { DesignerPromo } from "@/components/payments/designer-promo";
import { WithdrawButton } from "@/components/wallet/withdraw-form";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getWallet } from "@/lib/wallet/queries";
import { ProWalletExtras } from "@/components/pro/pro-wallet-extras";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { isPro } from "@/lib/pro/status";
import { pendingDesignerFee } from "@/lib/promos/promos";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wallet.metaTitle"), robots: { index: false } };
}

const STATUS_TONE = { requested: "bg-[#fff7e0] text-[#8a5105]", paid: "bg-success/10 text-success", rejected: "bg-danger/10 text-danger" } as const;

// D-10 Wallet + D-11 Withdraw (UI-JOURNEY, owner 2026-10-08).
export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=designer&next=/dashboard/wallet");
  if (user.role !== "designer") redirect("/dashboard");
  const [{ t, locale }, w, feeCode, hold] = await Promise.all([getI18n(), getWallet(user.id), pendingDesignerFee(user.id), getSettings(["timers.payout_hold_days"])]);
  const holdDays = formatNumber(hold["timers.payout_hold_days"], locale);
  const taka = (n: number) => formatTaka(n, locale);
  const fmt = (n: number) => formatNumber(n, locale);
  const lastTier = w.tiers.at(-1)?.min_wins ?? 1;
  // The newest paid withdrawal gets its "Payment sent" card on top (owner, 2026-10-12).
  const lastPaid = w.withdrawals.find((wd) => wd.status === "paid") ?? null;
  const progress = Math.min(100, Math.round((w.countedWins / Math.max(1, w.next ? w.next.tier.min_wins : lastTier)) * 100));

  const lastPaidAt = lastPaid ? (lastPaid.processedAt ?? lastPaid.createdAt) : null;

  // Owner, 2026-10-16: larger text everywhere, totals in the balance card and the payment card with its details.
  const body = (
      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
          {/* Balance */}
          <section className="relative flex flex-col overflow-clip rounded-[28px] bg-[image:var(--gradient-red-dark)] p-6 text-white sm:p-8" data-wallet-balance>
            <p className="m-0 text-[15px] font-bold uppercase tracking-[0.14em] text-gold">{t("wallet.available")}</p>
            <p className="lc-d m-0 mt-1 text-6xl font-semibold tabular-nums tracking-[-0.04em] text-gold">
              <CountUp value={w.balance} locale={locale} taka />
            </p>
            <p className="m-0 mt-4 text-[18px] text-white">
              {t("wallet.pending")}: <b className="tabular-nums">{taka(w.pending)}</b>
            </p>
            <p className="m-0 mt-1 text-[16px] leading-relaxed text-white/75">{t("wallet.pendingHint", { days: holdDays })}</p>
            {w.held.length > 0 && (
              <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                {w.held.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] bg-white/10 px-3.5 py-2.5 text-[16px] text-white/85 ring-1 ring-white/15">
                    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                      <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" />
                    </svg>
                    <b className="tabular-nums text-white">{taka(h.credit)}</b>
                    <span>{h.brand}</span>
                    <span className="text-white/65">· {h.availableAt ? t("wallet.heldUntil", { date: formatDate(h.availableAt, locale, "short") }) : t("wallet.heldClaim")}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 [&_p]:text-[16px] [&_p]:text-white/80">
              <WithdrawButton balance={w.balance} min={w.minWithdrawal} methods={w.methods} />
            </div>
            {/* Every taka so far (owner, 2026-10-16) */}
            <dl className="m-0 mt-auto grid grid-cols-1 gap-2.5 pt-7 sm:grid-cols-3">
              {[
                { k: t("wallet.sentSoFar"), v: taka(w.paidOut.total), sub: t("wallet.payments", { n: fmt(w.paidOut.count) }) },
                { k: t("wallet.onItsWay"), v: taka(w.requested.total), sub: w.requested.count ? t("wallet.payments", { n: fmt(w.requested.count) }) : t("wallet.nothingNow") },
                { k: t("wallet.earnedHere"), v: taka(w.earned), sub: t("wallet.earnedHint") },
              ].map((x) => (
                <div key={x.k} className="flex flex-col rounded-[18px] bg-white/10 px-4 py-3.5 ring-1 ring-white/15">
                  <dt className="text-[15px] text-white/75">{x.k}</dt>
                  <dd className="lc-d m-0 text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-white">{x.v}</dd>
                  <span className="text-[14px] text-white/65">{x.sub}</span>
                </div>
              ))}
            </dl>
          </section>

          {/* Fee tier */}
          <section className="lc-card p-6 sm:p-8">
            <h2 className="m-0 text-[24px] font-semibold tracking-[-0.02em] text-ink">{t("wallet.feeTitle")}</h2>
            <p className="lc-d m-0 mt-1 text-[34px] font-semibold leading-tight tracking-[-0.03em] text-primary">{t("wallet.feeNow", { rate: fmt(w.rate) })}</p>
            <p className="m-0 mt-1 text-[17px] text-muted">{t("wallet.wins", { n: fmt(w.countedWins) })}</p>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-[image:var(--gradient-red)]" style={{ width: `${w.next ? progress : 100}%` }} />
            </div>
            <p className="m-0 mt-2.5 text-[17px] font-semibold text-ink">{w.next ? t("wallet.toNext", { n: fmt(w.next.winsToGo), rate: fmt(w.next.tier.rate_percent) }) : t("wallet.lowest")}</p>
            <ol className="m-0 mt-5 grid list-none grid-cols-3 gap-2.5 p-0">
              {w.tiers.map((tier) => (
                <li key={tier.min_wins} className={cx("rounded-[18px] px-3 py-3.5 text-center ring-1", tier.rate_percent === w.rate ? "bg-tint/50 ring-2 ring-primary" : "bg-chip ring-transparent")}>
                  <p className="lc-d m-0 text-[24px] font-semibold text-ink">{fmt(tier.rate_percent)}%</p>
                  <p className="m-0 text-[15px] text-muted">{tier.min_wins === 0 ? t("designerHome.fees.first") : t("designerHome.fees.from", { n: fmt(tier.min_wins + 1) })}</p>
                </li>
              ))}
            </ol>
            <div className="[&_p]:text-[16px]">
              <DesignerPromo waiting={feeCode ? { code: feeCode.code, fee: feeCode.value } : null} />
            </div>
          </section>
        </div>

        {/* The newest "Payment sent" card with its details (owner, 2026-10-12; 2026-10-16: no empty space) */}
        {lastPaid && (
          <section id="payout-card" className="mt-3.5 scroll-mt-28 rounded-[28px] bg-[linear-gradient(135deg,#FFF1CF,#FFE2A6)] p-5 sm:p-7" data-payout-section>
            <div className="grid gap-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/cards/payout/${lastPaid.id}/square`}
                alt={t("payoutCard.alt", { amount: taka(lastPaid.amount) })}
                width={1080}
                height={1080}
                loading="lazy"
                className="aspect-square w-full max-w-[17rem] rounded-[22px] bg-[#FFDF9C] object-cover shadow-card"
              />
              <div className="flex min-w-0 flex-col gap-4">
                <div>
                  <h2 className="m-0 text-[28px] font-semibold tracking-[-0.02em] text-ink">{t("payoutCard.title")}</h2>
                  <p className="m-0 mt-1 text-[17px] text-[#4A3700]">{t("payoutCard.lead")}</p>
                </div>
                <dl className="m-0 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                  {[
                    { k: t("wallet.amountLabel"), v: taka(lastPaid.amount), big: true },
                    { k: t("wallet.sentTo"), v: lastPaid.destination },
                    { k: t("wallet.sentOn"), v: lastPaidAt ? formatDate(lastPaidAt, locale, "long") : "—" },
                    { k: t("wallet.txnLabel"), v: lastPaid.txnId ?? "—", mono: true },
                  ].map((x) => (
                    <div key={x.k} className="flex min-w-0 flex-col rounded-[16px] bg-white/70 px-4 py-3">
                      <dt className="text-[14px] font-semibold text-[#6b5200]">{x.k}</dt>
                      <dd className={cx("m-0 break-words font-bold text-ink", x.big ? "lc-d text-[24px] tabular-nums" : "text-[17px]", x.mono && "font-mono text-[16px]")}>{x.v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2.5">
                  <a href={`/api/cards/payout/${lastPaid.id}/square?download=1`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[image:var(--gradient-red)] px-6 text-[16px] font-bold text-white">
                    {t("payoutCard.square")}
                  </a>
                  <a href={`/api/cards/payout/${lastPaid.id}/story?download=1`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-[16px] font-bold text-primary ring-1 ring-line">
                    {t("payoutCard.story")}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Transactions */}
          <section>
            <h2 className="m-0 text-[clamp(24px,2.6vw,30px)] font-semibold tracking-[-0.03em] text-ink">{t("wallet.history")}</h2>
            {w.transactions.length === 0 ? (
              <div className="mt-4">
                <EmptyState title={t("wallet.empty")} />
              </div>
            ) : (
              <ul className="lc-card m-0 mt-4 list-none divide-y divide-line overflow-clip p-0">
                {w.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="m-0 text-[18px] font-semibold text-ink">{t(tx.note === "copy_claim_fine" ? "wallet.types.fine" : `wallet.types.${tx.type}`, { brand: tx.brand ?? "" })}</p>
                      {tx.feeRate !== null && tx.feeAmount !== null && (
                        <p className="m-0 mt-0.5 text-[15px] text-muted">{t("wallet.feeLine", { prize: taka(tx.amount + tx.feeAmount), rate: fmt(tx.feeRate), fee: taka(tx.feeAmount) })}</p>
                      )}
                      <p className="m-0 mt-0.5 text-[15px] text-muted">{formatDate(tx.createdAt, locale, "long")}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cx("m-0 text-[19px] font-bold tabular-nums", tx.amount >= 0 ? "text-success" : "text-danger")}>
                        {tx.amount >= 0 ? "+" : "−"}
                        {taka(Math.abs(tx.amount))}
                      </p>
                      <p className="m-0 mt-0.5 text-[15px] text-muted">{t("wallet.balanceAfter", { amount: taka(tx.balanceAfter) })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Withdrawals */}
          <section>
            <h2 className="m-0 text-[clamp(24px,2.6vw,30px)] font-semibold tracking-[-0.03em] text-ink">{t("wallet.withdrawals")}</h2>
            {w.withdrawals.length === 0 ? (
              <p className="mt-4 text-[17px] text-muted">{t("wallet.noWithdrawals")}</p>
            ) : (
              <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
                {w.withdrawals.map((wd) => (
                  <li key={wd.id} className="lc-card rounded-[20px] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="lc-d m-0 text-[24px] font-semibold tabular-nums text-ink">{taka(wd.amount)}</p>
                      <span className={cx("rounded-full px-3 py-1 text-[14px] font-bold", STATUS_TONE[wd.status])}>{t(`wallet.status.${wd.status}`)}</span>
                    </div>
                    <p className="m-0 mt-1.5 text-[16px] text-ink">{wd.destination}</p>
                    <p className="m-0 mt-0.5 text-[15px] text-muted">
                      {wd.status === "paid" && wd.processedAt ? t("wallet.paidOn", { date: formatDate(wd.processedAt, locale, "long") }) : t("wallet.askedOn", { date: formatDate(wd.createdAt, locale, "long") })}
                    </p>
                    {wd.txnId && <p className="m-0 mt-1 font-mono text-[15px] text-ink">{t("wallet.txn", { id: wd.txnId })}</p>}
                    {wd.status === "paid" && (
                      <a href={`/api/cards/payout/${wd.id}/square`} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center text-[16px] font-bold text-primary hover:underline">
                        {t("payoutCard.view")} →
                      </a>
                    )}
                    {wd.rejectReason && <p className="m-0 mt-1 text-[15px] text-danger">{t("wallet.reason", { reason: wd.rejectReason })}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Panel>
  );
  // Designer Pro plan (owner, 2026-10-13): the same wallet inside the Pro workspace, with earnings and Pro receipts.
  if (await isPro(user.id))
    return (
      <ProWorkspace user={user} active="wallet">
        <WsHead title={t("pro.wallet.title")} lead={t("pro.wallet.lead")} />
        <ProWalletExtras designerId={user.id} transactions={w.transactions} />
        {body}
      </ProWorkspace>
    );
  return (
    <PageShell>
      {/* Owner, 2026-10-13: a small title on top instead of the big panel. */}
      <SmallPageHeader title={t("wallet.title")} back={{ href: "/dashboard", label: t("nav.dashboard") }} />
      {body}
    </PageShell>
  );
}
