import Link from "@/components/ui/link";
import { CopyValue } from "@/components/admin/copy-value";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { str, qs } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, ADM_INPUT, KpiGrid, KpiTile, Pill, Tabs } from "@/components/admin/ui";
import { AutoWithdrawCard, WithdrawalActions } from "@/components/admin/withdrawal-row";
import { Avatar } from "@/components/ui/avatar";
import { designerMoney, type DesignerMoney, type MoneyNow, type PayoutRow } from "@/lib/admin/payouts";
import { cx } from "@/lib/cx";
import { timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";

const TABS = ["topay", "paid", "rejected", "all"] as const;
type Tab = (typeof TABS)[number];

/** 01XXXXXXXXX, the way the bKash app wants it. */
const localNumber = (n: string | undefined) => (n ?? "").replace(/\s+/g, "").replace(/^\+?880/, "0");
/** 01738 775864: easier to read out and check. */
const spaced = (n: string) => (n.length === 11 ? `${n.slice(0, 5)} ${n.slice(5)}` : n);
const dhakaMonth = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(d);

// Admin › Withdrawals (BLUEPRINT §7.3; owner 2026-10-16): who asked to be paid and where to send it, large and easy to
// copy; every payout already sent, who sent it and its transaction ID; and where the designers' money stands now.
export async function WithdrawalsView({
  sp,
  rows,
  now,
  auto,
  ready,
  canManage,
  moneyFor = designerMoney,
}: {
  sp: Record<string, string | string[] | undefined>;
  rows: PayoutRow[];
  now: MoneyNow;
  auto: boolean;
  ready: boolean;
  canManage: boolean;
  moneyFor?: (ids: string[]) => Promise<Map<string, DesignerMoney>>;
}) {
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "topay";
  const q = str(sp.q).trim().toLowerCase();
  const { t, locale } = await getI18n();
  const taka = (n: number) => formatTaka(n, locale);
  const num = (n: number) => formatNumber(n, locale);
  const tag = locale === "bn" ? "bn-BD" : "en-GB";
  const full = (d: Date) => d.toLocaleString(tag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const today = new Date();

  const waiting = rows.filter((r) => r.status === "requested").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const paid = rows.filter((r) => r.status === "paid").sort((a, b) => (b.processedAt ?? b.createdAt).getTime() - (a.processedAt ?? a.createdAt).getTime());
  const rejected = rows.filter((r) => r.status === "rejected");
  const sum = (list: PayoutRow[]) => list.reduce((a, r) => a + r.amount, 0);
  const paidThisMonth = paid.filter((r) => r.processedAt && dhakaMonth(r.processedAt) === dhakaMonth(today));
  const designersPaid = new Set(paid.map((r) => r.designer.id)).size;

  const digits = q.replace(/\D/g, "").replace(/^880/, "0");
  const matches = (r: PayoutRow) =>
    !q ||
    r.designer.name.toLowerCase().includes(q) ||
    (r.designer.username ?? "").toLowerCase().includes(q.replace(/^@/, "")) ||
    (digits.length >= 4 && (localNumber(r.full.bkash_number).includes(digits) || (r.full.account_number ?? "").includes(digits))) ||
    (r.txnId ?? "").toLowerCase().includes(q);
  const list = (tab === "topay" ? waiting : tab === "paid" ? paid : tab === "rejected" ? rejected : rows).filter(matches);
  const money: Map<string, DesignerMoney> = tab === "topay" ? await moneyFor(list.map((r) => r.designer.id)) : new Map();
  const href = (x: Tab) => `/admin/withdrawals${qs({ tab: x === "topay" ? undefined : x, q: str(sp.q) || undefined })}`;
  const kind = (r: PayoutRow) => t(`wallet.form.${r.full.bkash_kind === "agent" ? "agent" : "personal"}`);

  const sendTo = (r: PayoutRow) =>
    r.methodType === "bkash" ? (
      <div className="flex flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2 text-[16px] font-bold text-adm-strong">
          bKash
          {r.full.bkash_kind && <Pill tone={r.full.bkash_kind === "agent" ? "warn" : "neutral"}>{kind(r)}</Pill>}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[26px] font-bold tracking-[0.04em] text-ink tabular-nums" data-bkash-number>
            {spaced(localNumber(r.full.bkash_number))}
          </span>
          <CopyValue value={localNumber(r.full.bkash_number)} label={t("admin.withdrawals.copyNumber")} done={t("admin.withdrawals.copied")} />
        </span>
      </div>
    ) : (
      <dl className="m-0 grid gap-1.5 text-[16px]">
        {(
          [
            ["bank", r.full.bank_name],
            ["branch", r.full.branch],
            ["accountName", r.full.account_name],
            ["accountNumber", r.full.account_number],
            ["routing", r.full.routing_number],
          ] as const
        )
          .filter(([, v]) => Boolean(v))
          .map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <dt className="w-32 text-[14px] font-semibold text-muted">{t(`admin.withdrawals.bankFields.${k}`)}</dt>
              <dd className={cx("m-0 font-bold text-ink", (k === "accountNumber" || k === "routing") && "font-mono text-[18px]")}>{v}</dd>
              {k === "accountNumber" && v && <CopyValue value={v} label={t("admin.withdrawals.copy")} done={t("admin.withdrawals.copied")} className="min-h-9 px-3 text-[14px]" />}
            </div>
          ))}
      </dl>
    );

  const who = (r: PayoutRow, size: "lg" | "md") => (
    <Link href={`/admin/users/${r.designer.id}`} className="flex min-w-0 items-center gap-3 hover:text-primary">
      <Avatar name={r.designer.name} url={r.designer.avatarUrl} className={size === "lg" ? "size-12 shrink-0 text-base" : "size-10 shrink-0 text-sm"} />
      <span className="flex min-w-0 flex-col leading-tight">
        <strong className={cx("truncate", size === "lg" ? "text-[18px]" : "text-[16px]")}>{r.designer.name}</strong>
        {r.designer.username && <span className="truncate text-[15px] text-muted">@{r.designer.username}</span>}
      </span>
    </Link>
  );

  const label = "text-[13px] font-bold uppercase tracking-[0.08em] text-muted";

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.withdrawals.title")} lead={t("admin.withdrawals.leadNew")} />
      {/* Automatic bKash withdrawals (owner, 2026-10-15). */}
      <AutoWithdrawCard on={auto} ready={ready} canManage={canManage} />

      <KpiGrid>
        <KpiTile label={t("admin.withdrawals.kpi.toPay")} value={taka(sum(waiting))} hint={t("admin.withdrawals.kpi.requests", { n: num(waiting.length) })} icon="withdrawals" href={href("topay")} accent={waiting.length > 0} />
        <KpiTile label={t("admin.withdrawals.kpi.month")} value={taka(sum(paidThisMonth))} hint={t("admin.withdrawals.kpi.payments", { n: num(paidThisMonth.length) })} icon="payments" href={href("paid")} />
        <KpiTile label={t("admin.withdrawals.kpi.allTime")} value={taka(sum(paid))} hint={t("admin.withdrawals.kpi.allTimeHint", { n: num(paid.length), d: num(designersPaid) })} icon="check" href={href("paid")} />
        <KpiTile label={t("admin.withdrawals.kpi.wallets")} value={taka(now.inWallets)} hint={t("admin.withdrawals.kpi.walletsHint")} icon="revenue" />
        <KpiTile label={t("admin.withdrawals.kpi.notReleased")} value={taka(now.notReleased.total)} hint={t("admin.withdrawals.kpi.notReleasedHint", { n: num(now.notReleased.count) })} icon="contests" />
      </KpiGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label={t("admin.withdrawals.title")}
          items={TABS.map((x) => ({
            href: href(x),
            label: t(`admin.withdrawals.tabs.${x}`),
            active: x === tab,
            count: x === "topay" ? waiting.length : x === "paid" ? paid.length : x === "rejected" ? rejected.length : rows.length,
          }))}
        />
        <div className="flex flex-[1_1_360px] flex-wrap justify-end gap-2">
          <form action="/admin/withdrawals" className="flex min-w-0 flex-[1_1_260px] gap-2">
            {tab !== "topay" && <input type="hidden" name="tab" value={tab} />}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{t("admin.withdrawals.search")}</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-adm-soft">
                <AdminIcon name="search" />
              </span>
              <input type="search" name="q" defaultValue={str(sp.q)} placeholder={t("admin.withdrawals.searchHint")} className={cx(ADM_INPUT, "h-11 pl-10")} />
            </label>
            <button type="submit" className="h-11 shrink-0 rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-adm-deep">
              {t("admin.filter")}
            </button>
          </form>
          <a href="/admin/withdrawals/export" className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-adm-line bg-surface px-4 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
            <AdminIcon name="withdrawals" size={16} />
            {t("admin.payments.download")}
          </a>
        </div>
      </div>

      {list.length === 0 ? (
        <AdmCard className="p-5">
          <AdmEmpty>{tab === "topay" ? t("admin.withdrawals.empty") : t("admin.withdrawals.none")}</AdmEmpty>
        </AdmCard>
      ) : tab === "topay" ? (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {list.map((r) => {
            const m = money.get(r.designer.id);
            return (
              <AdmCard key={r.id} as="li" className="grid gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(0,15rem)_minmax(0,1.15fr)_minmax(0,1fr)_auto] xl:items-start" data-payout-card>
                {/* How much, to whom, since when */}
                <div className="flex flex-col gap-3">
                  <div>
                    <span className={label}>{t("admin.withdrawals.amount")}</span>
                    <strong className="lc-d block text-[40px] font-semibold leading-none tracking-[-0.03em] text-primary tabular-nums">{taka(r.amount)}</strong>
                  </div>
                  {who(r, "lg")}
                  <span className="text-[15px] text-muted">
                    {t("admin.withdrawals.requested", { date: full(r.createdAt) })}
                    <br />
                    <strong className="text-adm-strong">{timeAgo(r.createdAt, today, locale)}</strong>
                  </span>
                </div>
                {/* Where to send it */}
                <div className="flex flex-col gap-2 rounded-[16px] bg-adm-bg p-4 sm:p-5">
                  <span className={label}>{t("admin.withdrawals.to")}</span>
                  {sendTo(r)}
                </div>
                {/* This designer, money-wise */}
                <div className="flex flex-col gap-3 rounded-[16px] border border-adm-line p-4 sm:p-5">
                  <span className={label}>{t("admin.withdrawals.about")}</span>
                  <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[16px]">
                    {(
                      [
                        [t("admin.withdrawals.paidBefore"), m ? (m.paid.count ? t("admin.withdrawals.paidBeforeValue", { amount: taka(m.paid.total), n: num(m.paid.count) }) : t("admin.withdrawals.firstTime")) : "—"],
                        [t("admin.withdrawals.leftInWallet"), m ? taka(m.balance) : "—"],
                        [t("admin.withdrawals.earned"), m ? taka(m.earned) : "—"],
                        [t("admin.withdrawals.wins"), num(r.designer.wins)],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <dt className="text-[14px] font-semibold text-muted">{k}</dt>
                        <dd className="m-0 font-bold tabular-nums text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {m && m.recent.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-adm-line-soft pt-3">
                      <span className="text-[14px] font-semibold text-muted">{t("admin.withdrawals.moneyFrom")}</span>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]">
                        {m.recent.map((e, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate">{t(`wallet.types.${e.type === "bonus" ? "bonus" : e.type === "split_share" ? "split_share" : "prize_credit"}`, { brand: e.brand ?? "" })}</span>
                            <span className="shrink-0 font-bold tabular-nums text-adm-good">+{taka(e.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex xl:w-56 xl:justify-end">
                  <WithdrawalActions id={r.id} stacked />
                </div>
              </AdmCard>
            );
          })}
        </ul>
      ) : (
        <AdmCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-[16px]">
              <thead>
                <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
                  <th scope="col" className="px-5 py-3 font-bold">
                    {t("admin.withdrawals.cols.date")}
                  </th>
                  <th scope="col" className="px-3 py-3 font-bold">
                    {t("admin.withdrawals.cols.designer")}
                  </th>
                  <th scope="col" className="px-3 py-3 font-bold">
                    {t("admin.withdrawals.cols.sentTo")}
                  </th>
                  <th scope="col" className="px-3 py-3 font-bold">
                    {t("admin.withdrawals.cols.txn")}
                  </th>
                  <th scope="col" className="px-3 py-3 font-bold">
                    {t("admin.withdrawals.cols.status")}
                  </th>
                  <th scope="col" className="py-3 pl-3 pr-5 text-right font-bold">
                    {t("admin.withdrawals.amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-t border-adm-line-soft align-top hover:bg-[#fafafb]">
                    <td className="px-5 py-4">
                      <span className="flex flex-col">
                        <strong>{full(r.processedAt ?? r.createdAt)}</strong>
                        {r.processedAt && <span className="text-[14px] text-muted">{t("admin.withdrawals.askedOn", { date: full(r.createdAt) })}</span>}
                      </span>
                    </td>
                    <td className="px-3 py-4">{who(r, "md")}</td>
                    <td className="px-3 py-4">
                      <span className="flex flex-col">
                        <span className="font-semibold">{r.methodType === "bkash" ? `bKash${r.full.bkash_kind ? ` · ${kind(r)}` : ""}` : (r.full.bank_name ?? t("admin.withdrawals.bankFields.bank"))}</span>
                        <span className="font-mono text-[15px] text-ink">{r.methodType === "bkash" ? localNumber(r.full.bkash_number) : r.full.account_number}</span>
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {r.txnId ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-mono text-[15px] font-bold">{r.txnId}</span>
                          <span className="text-[14px] text-muted">{r.gateway === "manual" ? t("admin.withdrawals.byHand") : r.gateway === "fake" ? t("admin.payments.test") : r.gateway}</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <span className="flex flex-col items-start gap-1">
                        <Pill tone={r.status === "paid" ? "good" : r.status === "rejected" ? "bad" : "warn"}>{t(`admin.users.withdrawalStatus.${r.status}`)}</Pill>
                        {r.processedBy && <span className="text-[14px] text-muted">{t("admin.withdrawals.by", { name: r.processedBy })}</span>}
                        {r.rejectReason && <span className="max-w-64 text-[14px] text-adm-bad">{r.rejectReason}</span>}
                      </span>
                    </td>
                    <td className="py-4 pl-3 pr-5 text-right">
                      <span className="flex flex-col items-end gap-1">
                        <strong className="lc-d text-[19px] font-semibold tabular-nums">{taka(r.amount)}</strong>
                        {r.status === "paid" && (
                          <a href={`/api/cards/payout/${r.id}/square`} target="_blank" rel="noopener" className="text-[14px] font-bold text-primary hover:underline">
                            {t("admin.withdrawals.card")}
                          </a>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-adm-line">
                  <td colSpan={5} className="px-5 py-3.5 font-bold">
                    {t("admin.withdrawals.total", { n: num(list.length) })}
                  </td>
                  <td className="py-3.5 pl-3 pr-5 text-right">
                    <strong className="lc-d text-lg font-semibold tabular-nums text-primary">{taka(sum(list))}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </AdmCard>
      )}
    </div>
  );
}
