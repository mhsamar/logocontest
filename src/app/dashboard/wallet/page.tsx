import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CountUp } from "@/components/ui/count-up";
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
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <h1 className="text-h1 font-bold tracking-tight text-ink lg:text-4xl">{t("wallet.title")}</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Balance */}
        <section className="relative animate-rise overflow-clip rounded-[2rem] bg-gradient-to-br from-[#1f0a05] via-[#3a1208] to-primary-dark p-6 text-white shadow-raised sm:p-8">
          <span className="pointer-events-none absolute -right-10 -top-12 size-48 animate-float-soft rounded-full bg-[#f4bd2f]/25 blur-2xl" aria-hidden />
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#f6d98b]">{t("wallet.available")}</p>
          <p className="prize-text mt-1 text-5xl font-extrabold tabular-nums tracking-tight">
            <CountUp value={w.balance} locale={locale} taka />
          </p>
          <p className="mt-3 text-sm text-white/75" title={t("wallet.pendingHint")}>
            {t("wallet.pending")}: <b className="text-white">{taka(w.pending)}</b> <span className="text-white/60">· {t("wallet.pendingHint")}</span>
          </p>
          <div className="mt-6 [&_p]:text-white/70">
            <WithdrawButton balance={w.balance} min={w.minWithdrawal} methods={w.methods} />
          </div>
        </section>

        {/* Fee tier */}
        <section className="animate-rise rounded-[2rem] bg-surface p-6 shadow-card ring-1 ring-line" style={{ animationDelay: "100ms" }}>
          <h2 className="text-lg font-bold text-ink">{t("wallet.feeTitle")}</h2>
          <p className="mt-1 text-3xl font-extrabold text-[#7a4300]">{t("wallet.feeNow", { rate: fmt(w.rate) })}</p>
          <p className="text-sm text-muted">{t("wallet.wins", { n: fmt(w.countedWins) })}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="bar-fill h-full rounded-full bg-primary" style={{ width: `${w.next ? progress : 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink">{w.next ? t("wallet.toNext", { n: fmt(w.next.winsToGo), rate: fmt(w.next.tier.rate_percent) }) : t("wallet.lowest")}</p>
          <ol className="mt-4 grid grid-cols-3 gap-2">
            {w.tiers.map((tier) => (
              <li key={tier.min_wins} className={cx("rounded-xl px-3 py-2 text-center ring-1", tier.rate_percent === w.rate ? "bg-primary/5 ring-2 ring-primary" : "bg-canvas ring-line")}>
                <p className="text-lg font-bold text-ink">{fmt(tier.rate_percent)}%</p>
                <p className="text-[0.6875rem] text-muted">{tier.min_wins === 0 ? t("designerHome.fees.first") : t("designerHome.fees.from", { n: fmt(tier.min_wins + 1) })}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Transactions */}
        <section>
          <h2 className="text-h3 font-bold text-ink">{t("wallet.history")}</h2>
          {w.transactions.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("wallet.empty")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line overflow-clip rounded-2xl bg-surface shadow-card ring-1 ring-line">
              {w.transactions.map((tx, i) => (
                <li key={tx.id} className="reveal flex items-start justify-between gap-3 px-4 py-3" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{t(`wallet.types.${tx.type}`, { brand: tx.brand ?? "" })}</p>
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
          <h2 className="text-h3 font-bold text-ink">{t("wallet.withdrawals")}</h2>
          {w.withdrawals.length === 0 ? (
            <p className="mt-4 text-sm text-muted">—</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {w.withdrawals.map((wd) => (
                <li key={wd.id} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
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
    </div>
  );
}
