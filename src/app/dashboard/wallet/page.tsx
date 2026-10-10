import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { WithdrawButton } from "@/components/wallet/withdraw-form";
import { getCurrentUser } from "@/lib/auth/session";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getWallet } from "@/lib/wallet/queries";

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
  const [{ t, locale }, w] = await Promise.all([getI18n(), getWallet(user.id)]);
  const taka = (n: number) => formatTaka(n, locale);
  const fmt = (n: number) => formatNumber(n, locale);
  const lastTier = w.tiers.at(-1)?.min_wins ?? 1;
  const progress = Math.min(100, Math.round((w.countedWins / Math.max(1, w.next ? w.next.tier.min_wins : lastTier)) * 100));

  return (
    <PageShell>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle lead={t("wallet.title")} />
      </Panel>

      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="grid gap-3.5 lg:grid-cols-[1.3fr_1fr]">
          {/* Balance */}
          <section className="relative overflow-clip rounded-[28px] bg-[image:var(--gradient-red-dark)] p-6 text-white sm:p-8">
            <p className="m-0 text-sm font-bold uppercase tracking-[0.14em] text-gold">{t("wallet.available")}</p>
            <p className="lc-d m-0 mt-1 text-5xl font-semibold tabular-nums tracking-[-0.04em] text-gold">
              <CountUp value={w.balance} locale={locale} taka />
            </p>
            <p className="m-0 mt-3 text-sm text-white/75" title={t("wallet.pendingHint")}>
              {t("wallet.pending")}: <b className="text-white">{taka(w.pending)}</b> <span className="text-white/60">· {t("wallet.pendingHint")}</span>
            </p>
            {w.held.length > 0 && (
              <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                {w.held.map((h, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] bg-white/10 px-3 py-2 text-sm text-white/85 ring-1 ring-white/15">
                    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-gold" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                      <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" />
                    </svg>
                    <b className="tabular-nums text-white">{taka(h.credit)}</b>
                    <span>{h.brand}</span>
                    <span className="text-white/60">· {h.availableAt ? t("wallet.heldUntil", { date: formatDate(h.availableAt, locale, "short") }) : t("wallet.heldClaim")}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 [&_p]:text-white/70">
              <WithdrawButton balance={w.balance} min={w.minWithdrawal} methods={w.methods} />
            </div>
          </section>

          {/* Fee tier */}
          <section className="lc-card p-6 sm:p-8">
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em] text-ink">{t("wallet.feeTitle")}</h2>
            <p className="lc-d m-0 mt-1 text-3xl font-semibold tracking-[-0.03em] text-primary">{t("wallet.feeNow", { rate: fmt(w.rate) })}</p>
            <p className="m-0 text-sm text-muted">{t("wallet.wins", { n: fmt(w.countedWins) })}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-[image:var(--gradient-red)]" style={{ width: `${w.next ? progress : 100}%` }} />
            </div>
            <p className="m-0 mt-2 text-sm text-ink">{w.next ? t("wallet.toNext", { n: fmt(w.next.winsToGo), rate: fmt(w.next.tier.rate_percent) }) : t("wallet.lowest")}</p>
            <ol className="m-0 mt-4 grid list-none grid-cols-3 gap-2 p-0">
              {w.tiers.map((tier) => (
                <li key={tier.min_wins} className={cx("rounded-[16px] px-3 py-2.5 text-center ring-1", tier.rate_percent === w.rate ? "bg-tint/50 ring-2 ring-primary" : "bg-chip ring-transparent")}>
                  <p className="lc-d m-0 text-lg font-semibold text-ink">{fmt(tier.rate_percent)}%</p>
                  <p className="m-0 text-[0.6875rem] text-muted">{tier.min_wins === 0 ? t("designerHome.fees.first") : t("designerHome.fees.from", { n: fmt(tier.min_wins + 1) })}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          {/* Transactions */}
          <section>
            <h2 className="m-0 text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.03em] text-ink">{t("wallet.history")}</h2>
            {w.transactions.length === 0 ? (
              <div className="mt-4">
                <EmptyState title={t("wallet.empty")} />
              </div>
            ) : (
              <ul className="lc-card m-0 mt-4 list-none divide-y divide-line overflow-clip p-0">
                {w.transactions.map((tx) => (
                  <li key={tx.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{t(tx.note === "copy_claim_fine" ? "wallet.types.fine" : `wallet.types.${tx.type}`, { brand: tx.brand ?? "" })}</p>
                      {tx.feeRate !== null && tx.feeAmount !== null && (
                        <p className="text-xs text-muted">{t("wallet.feeLine", { prize: taka(tx.amount + tx.feeAmount), rate: fmt(tx.feeRate), fee: taka(tx.feeAmount) })}</p>
                      )}
                      <p className="text-xs text-muted">{formatDate(tx.createdAt, locale, "short")}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cx("font-bold tabular-nums", tx.amount >= 0 ? "text-success" : "text-danger")}>
                        {tx.amount >= 0 ? "+" : "−"}
                        {taka(Math.abs(tx.amount))}
                      </p>
                      <p className="text-xs text-muted">{t("wallet.balanceAfter", { amount: taka(tx.balanceAfter) })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Withdrawals */}
          <section>
            <h2 className="m-0 text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.03em] text-ink">{t("wallet.withdrawals")}</h2>
            {w.withdrawals.length === 0 ? (
              <p className="mt-4 text-sm text-muted">—</p>
            ) : (
              <ul className="m-0 mt-4 list-none space-y-2 p-0">
                {w.withdrawals.map((wd) => (
                  <li key={wd.id} className="lc-card rounded-[20px] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold tabular-nums text-ink">{taka(wd.amount)}</p>
                      <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[wd.status])}>{t(`wallet.status.${wd.status}`)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {wd.destination} · {formatDate(wd.createdAt, locale, "short")}
                    </p>
                    {wd.txnId && <p className="mt-1 font-mono text-xs text-ink">{t("wallet.txn", { id: wd.txnId })}</p>}
                    {wd.rejectReason && <p className="mt-1 text-xs text-danger">{t("wallet.reason", { reason: wd.rejectReason })}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </Panel>
    </PageShell>
  );
}
