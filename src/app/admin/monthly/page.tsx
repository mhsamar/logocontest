/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { CardPreview, RewardNote, RewardSwitches } from "@/components/admin/monthly-bits";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { monthLabel } from "@/lib/notifications/render";
import { adminRewards, type AdminReward } from "@/lib/rewards/admin";
import type { ClaimStatus } from "@/lib/rewards/claims";
import { approveMonthNow, clearTestResults, closeMonthNow, markReward, remindRewardNow } from "@/lib/rewards/month-actions";
import { monthClose } from "@/lib/rewards/month-close";
import { monthRace, type MonthRace } from "@/lib/rewards/race";
import { daysLeft } from "@/lib/rewards/race-rules";
import { isMonthKey, monthKey, monthRange, previousMonth, recentMonths } from "@/lib/rewards/rules";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.monthly.title"), robots: { index: false } };
}

const FILTERS = ["all", "call", "called", "not_claimed", "delivered"] as const;
type Filter = (typeof FILTERS)[number];
const IN_FILTER: Record<Filter, (s: ClaimStatus) => boolean> = {
  all: () => true,
  call: (s) => s === "claimed",
  called: (s) => s === "contacted",
  not_claimed: (s) => s === "not_claimed",
  delivered: (s) => s === "delivered",
};
const SHOWN = 5;
const card = "rounded-2xl bg-surface shadow-card ring-1 ring-line";

const Initial = ({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) =>
  url ? (
    <img src={url} alt="" width={size} height={size} className="flex-none rounded-[11px] object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="lc-d flex flex-none items-center justify-center rounded-[11px] bg-[#F0F1F4] font-semibold text-[#3A3C45]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.replace(/^@/, "").charAt(0).toUpperCase() || "?"}
    </span>
  );

// A-08 Monthly winner (owner, 2026-10-11; Design/rewards/admin-monthly-winner.html): who is winning the smartphone and
// the gift box, the switches, the month close, and every prize and its claim.
export default async function AdminMonthlyPage({ searchParams }: PageProps<"/admin/monthly">) {
  await requirePermission("monthly.view");
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const now = new Date();
  const current = monthKey(now);
  const months = recentMonths(current, 6);
  const month = typeof sp.month === "string" && isMonthKey(sp.month) && months.includes(sp.month) ? sp.month : current;
  const test = sp.test === "1";
  const filter: Filter = FILTERS.find((f) => f === sp.status) ?? "all";
  const full = sp.full === "designers" || sp.full === "clients" ? sp.full : null;

  const [race, rewards, close, lastClose, s] = await Promise.all([
    monthRace(month, { testMode: test }),
    adminRewards(test),
    monthClose(month, test),
    month === current ? monthClose(previousMonth(current), test) : Promise.resolve(null),
    getSettings(["rewards.program_on", "rewards.win_card_on", "rewards.smartphone_card_on", "rewards.gift_box_card_on", "rewards.ask_first"]),
  ]);
  const fmt = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Dhaka" });
  const day = (d: Date) => d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const shortMonth = (m: string) => new Date(monthRange(m).start.getTime() + 43_200_000).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
  const href = (p: Record<string, string | null>) => {
    const q = { month: month === current ? null : month, test: test ? "1" : null, status: filter === "all" ? null : filter, full, claim: typeof sp.claim === "string" ? sp.claim : null, ...p };
    const qs = Object.entries(q)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
      .join("&");
    return qs ? `/admin/monthly?${qs}` : "/admin/monthly";
  };

  const topDesigner = race.designers[0] ?? null;
  const topClient = race.clients[0] ?? null;
  const waiting = rewards.filter((r) => r.status === "claimed").length;
  const shown = rewards.filter((r) => IN_FILTER[filter](r.status));
  const selected = rewards.find((r) => r.id === sp.claim) ?? shown.find((r) => r.status === "claimed") ?? shown[0] ?? null;
  const name = monthLabel(month, locale);
  const lastDay = new Date(monthRange(month).end.getTime() - 60_000);
  const closable = !close.status && (month === current || month === previousMonth(current));

  // KPI 3: when the cards go out, or what happened.
  const goOut =
    close.status === "sent"
      ? { big: day(close.closedAt!), small: t("admin.monthly.kpi.sent") }
      : close.status === "waiting_approval"
        ? { big: t("admin.monthly.kpi.waitingBig"), small: t("admin.monthly.kpi.waiting") }
        : close.status === "no_winner"
          ? { big: day(close.closedAt!), small: t("admin.monthly.kpi.noWinner") }
          : month === current
            ? { big: day(lastDay), small: t("admin.monthly.kpi.at", { days: fmt(daysLeft(month, now)) }) }
            : { big: t("admin.monthly.kpi.notClosedBig"), small: t("admin.monthly.kpi.notClosed") };

  return (
    <div className="space-y-5">
      <AdminHead
        title={t("admin.monthly.title")}
        lead={t("admin.monthly.lead")}
        actions={
          <details className="relative">
            <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-[#DCDEE3] bg-surface px-4 text-[15px] font-bold text-ink [&::-webkit-details-marker]:hidden">
              {name}
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <ul className="absolute right-0 z-20 m-0 mt-1.5 w-52 list-none rounded-xl bg-surface p-1.5 shadow-card ring-1 ring-line">
              {months.map((m) => (
                <li key={m}>
                  <Link href={href({ month: m === current ? null : m, claim: null, full: null })} className={cx("flex min-h-10 items-center rounded-lg px-3 text-[15px] font-semibold", m === month ? "bg-[#FBECEB] text-primary" : "text-ink hover:bg-canvas")}>
                    {monthLabel(m, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        }
      />

      {test && <p className="m-0 rounded-xl bg-[#FFF4D1] px-4 py-3 text-[15px] font-semibold text-[#6B4E00]">{t("admin.monthly.testBanner")}</p>}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <Kpi name tone="red" label={t("admin.monthly.kpi.topDesigner")} big={topDesigner?.profile.name ?? "—"} small={topDesigner ? t("admin.monthly.kpi.designerLine", { wins: fmt(topDesigner.wins), earned: taka(topDesigner.earned) }) : t("admin.monthly.kpi.nobody")} />
        <Kpi name label={t("admin.monthly.kpi.topClient")} big={topClient?.profile.name ?? "—"} small={topClient ? t("admin.monthly.kpi.clientLine", { contests: fmt(topClient.contests), prizes: taka(topClient.prizeTotal) }) : t("admin.monthly.kpi.nobody")} />
        <Kpi label={t("admin.monthly.kpi.goOut")} big={goOut.big} small={goOut.small} />
        <Kpi tone="orange" label={t("admin.monthly.kpi.claims")} big={fmt(waiting)} small={t("admin.monthly.kpi.claimsLine")} />
      </div>

      {/* Sent automatically: switches, month close, rules */}
      <section className={cx(card, "flex flex-col gap-3.5 p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em] text-ink">{t("admin.monthly.auto")}</h2>
          <div className="flex flex-wrap gap-2">
            <CardPreview month={month} test={test} names={{ smartphone: topClient?.profile.name ?? null, gift_box: topDesigner?.profile.name ?? null }} />
            {closable && (
              <AdminAction
                label={test ? t("admin.monthClose.runTest") : t("admin.monthClose.closeNow")}
                tone="primary"
                body={test ? t("admin.monthClose.runTestBody", { month: name }) : t("admin.monthClose.closeNowBody", { month: name })}
                fields={[]}
                run={closeMonthNow.bind(null, month, test)}
              />
            )}
          </div>
        </div>
        {/* Owner, 2026-10-13: one switch for the whole program; off hides it on the whole site. */}
        <RewardSwitches items={[{ key: "rewards.program_on", title: t("admin.monthly.switches.program"), lead: t("admin.monthly.switches.programLead"), on: s["rewards.program_on"] }]} />
        {!s["rewards.program_on"] && <p className="m-0 rounded-xl bg-[#FFF7ED] px-4 py-3 text-[14.5px] text-[#7A3A0C]">{t("admin.monthly.switches.programOff")}</p>}
        <RewardSwitches
          items={[
            { key: "rewards.win_card_on", title: t("admin.monthly.switches.win"), lead: t("admin.monthly.switches.winLead"), on: s["rewards.win_card_on"] },
            { key: "rewards.smartphone_card_on", title: t("admin.monthly.switches.smartphone"), lead: t("admin.monthly.switches.smartphoneLead"), on: s["rewards.smartphone_card_on"] },
            { key: "rewards.gift_box_card_on", title: t("admin.monthly.switches.giftBox"), lead: t("admin.monthly.switches.giftBoxLead"), on: s["rewards.gift_box_card_on"] },
            { key: "rewards.ask_first", title: t("admin.monthly.switches.askFirst"), lead: t("admin.monthly.switches.askFirstLead"), on: s["rewards.ask_first"] },
          ]}
        />
        {[lastClose && lastClose.status === "waiting_approval" ? { m: previousMonth(current), c: lastClose } : null, { m: month, c: close }]
          .filter((x): x is { m: string; c: Awaited<ReturnType<typeof monthClose>> } => Boolean(x))
          .map(({ m, c }) => (
            <div key={m} className={cx("flex flex-wrap items-center justify-between gap-2.5 rounded-xl px-4 py-3 text-[15px]", c.status === "waiting_approval" ? "bg-[#FFF7ED] text-[#7A3A0C]" : "bg-canvas text-ink")}>
              <span>
                {c.status === "waiting_approval"
                  ? t("admin.monthClose.waiting", { month: monthLabel(m, locale) })
                  : c.status === "sent"
                    ? t("admin.monthClose.sent", { month: monthLabel(m, locale), date: when(c.closedAt!) })
                    : c.status === "no_winner"
                      ? t("admin.monthClose.noWinner", { month: monthLabel(m, locale), date: when(c.closedAt!) })
                      : t("admin.monthClose.notClosed", { month: monthLabel(m, locale) })}
                {c.status && c.byJob && <span className="text-muted"> ({t("admin.monthClose.byJob")})</span>}
              </span>
              {c.status === "waiting_approval" && (
                <AdminAction label={t("admin.monthClose.approve")} tone="primary" body={t("admin.monthClose.approveBody", { month: monthLabel(m, locale) })} fields={[]} run={approveMonthNow.bind(null, m, test)} />
              )}
            </div>
          ))}
        <p className="m-0 text-[14.5px] text-muted">
          <strong className="text-[#3A3C45]">{t("admin.monthly.rulesLabel")}</strong> {t("admin.monthly.rules")}
        </p>
      </section>

      {/* Who is winning */}
      <div className="flex flex-wrap items-start gap-4">
        <RaceTable
          title={t("admin.monthly.designers.title")}
          prize={t("admin.monthly.designers.prize")}
          cols={[t("admin.monthly.designers.who"), t("admin.monthly.designers.wins"), t("admin.monthly.designers.contests"), t("admin.monthly.designers.earned")]}
          empty={t("admin.monthly.designers.empty")}
          rows={(full === "designers" ? race.designers : race.designers.slice(0, SHOWN)).map((d, i) => ({
            id: d.id,
            profile: d.profile,
            main: fmt(d.wins),
            second: t("admin.monthly.designers.joined", { n: fmt(d.joined) }),
            third: taka(d.earned),
            note: i === 1 ? (topDesigner!.wins === d.wins ? t("admin.monthly.designers.equal") : t("admin.monthly.designers.behind", { n: fmt(topDesigner!.wins - d.wins) })) : null,
          }))}
          leading={t("admin.monthly.leading")}
          total={race.designers.length ? t("admin.monthly.designers.total", { wins: fmt(race.designers.reduce((a, d) => a + d.wins, 0)), earned: taka(race.designers.reduce((a, d) => a + d.earned, 0)) }) : null}
          totalLabel={t("admin.monthly.designers.all")}
          more={race.designers.length > SHOWN ? { href: href({ full: full === "designers" ? null : "designers" }), label: full === "designers" ? t("admin.monthly.showFewer") : t("admin.monthly.designers.seeAll") } : null}
        />
        <RaceTable
          title={t("admin.monthly.clients.title")}
          prize={t("admin.monthly.clients.prize")}
          cols={[t("admin.monthly.clients.who"), t("admin.monthly.clients.contests"), t("admin.monthly.clients.prizes"), t("admin.monthly.clients.spent")]}
          empty={t("admin.monthly.clients.empty")}
          rows={(full === "clients" ? race.clients : race.clients.slice(0, SHOWN)).map((c, i) => ({
            id: c.id,
            profile: c.profile,
            main: fmt(c.contests),
            second: taka(c.prizeTotal),
            third: taka(c.spent),
            note: i === 1 ? (topClient!.contests === c.contests ? t("admin.monthly.clients.equal") : t("admin.monthly.clients.behind", { n: fmt(topClient!.contests - c.contests) })) : null,
          }))}
          leading={t("admin.monthly.leading")}
          total={race.clients.length ? t("admin.monthly.clients.total", { contests: fmt(race.clients.reduce((a, c) => a + c.contests, 0)), spent: taka(race.clients.reduce((a, c) => a + c.spent, 0)) }) : null}
          totalLabel={t("admin.monthly.clients.all")}
          more={race.clients.length > SHOWN ? { href: href({ full: full === "clients" ? null : "clients" }), label: full === "clients" ? t("admin.monthly.showFewer") : t("admin.monthly.clients.seeAll") } : null}
        />
      </div>

      {/* Prizes and claims, and the selected claim */}
      <div className="flex flex-wrap items-start gap-4">
        <section className={cx(card, "min-w-0 flex-[4_1_600px] overflow-hidden")}>
          <div className="flex flex-wrap items-center gap-2.5 p-3.5">
            <h2 className="m-0 px-1.5 text-[21px] font-semibold tracking-[-0.025em] text-ink">{t("admin.monthly.claims.title")}</h2>
            <nav aria-label={t("admin.monthly.claims.filter")} className="flex flex-wrap gap-2 sm:ml-auto">
              {FILTERS.map((f) => {
                const n = rewards.filter((r) => IN_FILTER[f](r.status)).length;
                const on = f === filter;
                return (
                  <Link
                    key={f}
                    href={href({ status: f === "all" ? null : f, claim: null })}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={cx("inline-flex h-[42px] items-center gap-2 rounded-[10px] px-4 text-[15px] font-bold", on ? "bg-primary text-white" : "bg-[#F4F5F7] text-[#3A3C45]")}
                  >
                    {t(`admin.monthly.claims.filters.${f}`)}
                    <span className={cx("rounded-full px-2 py-px text-[13px]", on ? "bg-white/20" : "bg-white")}>{fmt(n)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          {shown.length === 0 ? (
            <p className="m-0 border-t border-[#EEEFF2] px-5 py-10 text-center text-muted">{rewards.length ? t("admin.monthly.claims.noneHere") : t("admin.monthly.claims.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-[15.5px]">
                <thead>
                  <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
                    <th scope="col" className="py-2.5 pl-5 pr-2.5 font-bold">{t("admin.monthly.claims.claim")}</th>
                    <th scope="col" className="p-2.5 font-bold">{t("admin.monthly.claims.winner")}</th>
                    <th scope="col" className="p-2.5 font-bold">{t("admin.monthly.claims.prize")}</th>
                    <th scope="col" className="py-2.5 pl-2.5 pr-5 font-bold">{t("admin.monthly.claims.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => {
                    const on = r.id === selected?.id;
                    const link = href({ claim: r.id });
                    return (
                      <tr key={r.id} className={cx("border-t border-[#EEEFF2]", on ? "bg-[#FDF6F5] shadow-[inset_3px_0_0_#8B0000]" : "hover:bg-[#FAFAFB]")}>
                        <td className="py-3.5 pl-5 pr-2.5">
                          <Link href={link} scroll={false} className="flex flex-col items-start gap-1">
                            <Cid>{r.number}</Cid>
                            <span className="whitespace-nowrap text-[14px] text-muted">{shortMonth(r.month)}</span>
                          </Link>
                        </td>
                        <td className="p-2.5">
                          <Link href={link} scroll={false} className="flex items-center gap-2.5">
                            <Initial name={r.winner.name} url={r.winner.avatarUrl} />
                            <span className="flex flex-col gap-0.5">
                              <strong className="whitespace-nowrap text-ink">{r.winner.name}</strong>
                              <span className="whitespace-nowrap text-[14px] text-muted">{whoLine(r, t, fmt)}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="p-2.5">
                          <span className="flex flex-col gap-0.5">
                            <strong className="whitespace-nowrap text-ink">{r.kind === "smartphone" ? t("admin.monthClose.smartphone") : t("admin.monthClose.giftBox")}</strong>
                            <span className="whitespace-nowrap text-[14px] text-muted">{r.sentAt ? t("admin.monthly.claims.cardSent", { date: when(r.sentAt) }) : t("admin.monthClose.notSentYet")}</span>
                          </span>
                        </td>
                        <td className="py-3.5 pl-2.5 pr-5">
                          <span className="flex flex-col items-start gap-1">
                            <StatusTag status={r.status} t={t} />
                            <span className="whitespace-nowrap text-[14px] text-muted">{statusLine(r, t, fmt, when, day)}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <aside className={cx(card, "flex min-w-0 flex-[2_1_340px] flex-col gap-3.5 p-[18px] sm:p-[22px]")}>
            <div className="flex items-center justify-between gap-2.5">
              <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em] text-ink">{t("admin.monthly.detail.title")}</h2>
              <Cid>{selected.number}</Cid>
            </div>
            <div className="flex items-center gap-3">
              <Initial name={selected.winner.name} url={selected.winner.avatarUrl} size={48} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <Link href={`/admin/users/${selected.winner.id}`} className="truncate text-[17px] font-bold text-ink hover:text-primary">
                  {selected.winner.name}
                </Link>
                <span className="text-[14px] text-muted">
                  {t(selected.kind === "smartphone" ? "admin.monthly.detail.client" : "admin.monthly.detail.designer")} · {selected.kind === "smartphone" ? t("admin.monthClose.smartphone") : t("admin.monthClose.giftBox")} · {monthLabel(selected.month, locale)}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(selected.kind === "smartphone"
                ? [
                    [t("admin.monthly.clients.contests"), fmt(selected.stats.contests ?? 0)],
                    [t("monthlyReward.page.prizeMoney"), taka(selected.stats.prize_total ?? 0)],
                    [t("admin.monthly.clients.spent"), taka(selected.stats.spent ?? 0)],
                  ]
                : [
                    [t("admin.monthly.designers.wins"), fmt(selected.stats.wins ?? 0)],
                    [t("admin.monthly.designers.contests"), fmt(selected.stats.joined ?? 0)],
                    [t("admin.monthly.designers.earned"), taka(selected.stats.earned ?? 0)],
                  ]
              ).map(([label, value]) => (
                <div key={label} className="flex-[1_1_100px] rounded-xl bg-[#F4F5F7] px-3 py-2.5">
                  <span className="block text-[13px] font-bold text-muted">{label}</span>
                  <strong className="lc-d text-[20px] font-semibold text-ink">{value}</strong>
                </div>
              ))}
            </div>
            <div>
              <div className="pb-1.5 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">{t("admin.monthly.detail.fromForm")}</div>
              {(
                [
                  ...(selected.claim
                    ? [
                        [t("monthlyReward.form.name"), selected.claim.name],
                        [
                          t("monthlyReward.form.mobile"),
                          <a key="m" href={`tel:${selected.claim.mobile}`} className="text-primary">
                            {`${selected.claim.mobile.slice(0, 5)}-${selected.claim.mobile.slice(5)}`}
                          </a>,
                        ],
                        [t("monthlyReward.form.address"), selected.claim.address],
                        [t("admin.monthly.detail.claimed"), when(selected.claimedAt!)],
                      ]
                    : [[t("admin.monthly.detail.claimed"), t("admin.monthly.detail.notYet")]]),
                  [t("admin.monthly.detail.cardSent"), selected.sentAt ? `${when(selected.sentAt)}${selected.seen ? ` · ${t("admin.monthly.detail.seen")}` : ""}` : t("admin.monthClose.notSentYet")],
                  ...(selected.contactedAt ? [[t("admin.monthly.detail.contacted"), when(selected.contactedAt)]] : []),
                  ...(selected.deliveredAt ? [[t("admin.monthly.detail.delivered"), when(selected.deliveredAt)]] : []),
                  ...(selected.status === "not_claimed" ? [[t("admin.monthly.detail.reminders"), fmt(selected.reminderCount)]] : []),
                ] as [string, React.ReactNode][]
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-t border-[#EEEFF2] py-2.5 text-[15px]">
                  <span className="shrink-0 text-muted">{label}</span>
                  <span className="min-w-0 text-right font-semibold text-ink [overflow-wrap:anywhere]">{value}</span>
                </div>
              ))}
            </div>
            <RewardNote key={selected.id} id={selected.id} note={selected.note} />
            <div className="flex flex-col gap-2 [&>button]:w-full">
              {selected.status === "claimed" && (
                <AdminAction label={t("admin.monthly.detail.markContacted")} tone="primary" body={t("admin.monthly.detail.markContactedBody", { name: selected.winner.name })} fields={[]} run={markReward.bind(null, selected.id, "contacted")} />
              )}
              {(selected.status === "claimed" || selected.status === "contacted") && (
                <AdminAction
                  label={t("admin.monthly.detail.markDelivered")}
                  tone={selected.status === "contacted" ? "primary" : "secondary"}
                  body={t("admin.monthly.detail.markDeliveredBody", { name: selected.winner.name })}
                  fields={[]}
                  run={markReward.bind(null, selected.id, "delivered")}
                />
              )}
              {selected.status === "not_claimed" && selected.sentAt && (
                <AdminAction label={t("admin.monthly.detail.remind")} body={t("admin.monthly.detail.remindBody", { name: selected.winner.name })} fields={[]} run={remindRewardNow.bind(null, selected.id)} />
              )}
            </div>
            <a href={selected.card} target="_blank" rel="noreferrer" className="text-[14.5px] font-bold text-primary">
              {t("admin.monthly.detail.seeCard")}
            </a>
          </aside>
        )}
      </div>

      {/* Test mode */}
      <section className="space-y-2.5 rounded-2xl border border-dashed border-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="m-0 text-lg font-bold text-ink">{t("admin.monthClose.testTitle")}</h2>
          <Link href={test ? "/admin/monthly" : "/admin/monthly?test=1"} className="rounded-[10px] border border-[#DCDEE3] bg-surface px-4 py-2 text-[15px] font-bold text-ink">
            {test ? t("admin.monthly.testOff") : t("admin.monthly.testOn")}
          </Link>
        </div>
        <p className="m-0 text-sm text-muted">{t("admin.monthClose.testLead")}</p>
        {test && close.status && (
          <AdminAction label={t("admin.monthClose.clearTest")} tone="ghost" body={t("admin.monthClose.clearTestBody", { month: name })} fields={[]} run={clearTestResults.bind(null, month)} />
        )}
      </section>
    </div>
  );
}

type T = Awaited<ReturnType<typeof getI18n>>["t"];

function Kpi({ label, big, small, tone, name = false }: { label: string; big: string; small: string; tone?: "red" | "orange"; name?: boolean }) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1.5 rounded-2xl p-4 ring-1 sm:p-5",
        tone === "red" ? "bg-primary text-white ring-primary" : tone === "orange" ? "bg-[#FFF7ED] ring-[#F6D9B8]" : "bg-surface shadow-card ring-line",
      )}
    >
      <span className={cx("text-[14.5px] font-semibold", tone === "red" ? "text-[#F6DAD8]" : tone === "orange" ? "text-[#7A3A0C]" : "text-muted")}>{label}</span>
      {/* A person's name may be long: smaller, and up to two lines */}
      <span
        className={cx(
          "lc-d font-semibold tracking-[-0.03em]",
          name ? "line-clamp-2 text-[21px] leading-[1.1] [overflow-wrap:anywhere] sm:text-[26px]" : "truncate text-[26px] leading-none sm:text-[34px]",
          tone === "orange" ? "text-[#9A3412]" : tone === "red" ? "" : "text-ink",
        )}
      >
        {big}
      </span>
      <span className={cx("text-[14px]", tone === "red" ? "text-[#F6DAD8]" : tone === "orange" ? "text-[#7A3A0C]" : "text-muted")}>{small}</span>
    </div>
  );
}

const Cid = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex self-start rounded-[7px] border border-[#E3E4E8] bg-white px-2 py-0.5 font-mono text-[12.5px] font-semibold tracking-[.04em] text-[#3A3C45]">{children}</span>
);

function RaceTable(p: {
  title: string;
  prize: string;
  cols: string[];
  empty: string;
  rows: { id: string; profile: MonthRace["designers"][number]["profile"]; main: string; second: string; third: string; note: string | null }[];
  leading: string;
  total: string | null;
  totalLabel: string;
  more: { href: string; label: string } | null;
}) {
  return (
    <section className={cx(card, "min-w-0 flex-[1_1_480px] overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-[18px]">
        <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em] text-ink">{p.title}</h2>
        <span className="text-[14px] font-bold text-muted">{p.prize}</span>
      </div>
      {p.rows.length === 0 ? (
        <p className="m-0 border-t border-[#EEEFF2] px-5 py-8 text-center text-muted">{p.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[430px] border-collapse text-[15.5px]">
            <thead>
              <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
                <th scope="col" className="py-2.5 pl-5 pr-2.5 font-bold">{p.cols[0]}</th>
                <th scope="col" className="p-2.5 font-bold">{p.cols[1]}</th>
                <th scope="col" className="p-2.5 font-bold">{p.cols[2]}</th>
                <th scope="col" className="py-2.5 pl-2.5 pr-5 text-right font-bold">{p.cols[3]}</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r, i) => (
                <tr key={r.id} className={cx("border-t border-[#EEEFF2]", i === 0 && "bg-[#FDF6F5] shadow-[inset_3px_0_0_#8B0000]")}>
                  <td className="py-3 pl-5 pr-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={cx("lc-d flex size-[30px] flex-none items-center justify-center rounded-[9px] text-[15px] font-semibold", i === 0 ? "bg-primary text-white" : "bg-[#F0F1F4] text-[#3A3C45]")}>{i + 1}</span>
                      <Initial name={r.profile.name} url={r.profile.avatarUrl} />
                      <div className="flex min-w-0 flex-col items-start gap-[3px]">
                        <Link href={`/admin/users/${r.id}`} className="whitespace-nowrap font-bold text-ink hover:text-primary">
                          {r.profile.name}
                        </Link>
                        {i === 0 ? <span className="rounded-full bg-[#E3F3EA] px-2.5 py-0.5 text-[12.5px] font-bold text-[#14633C]">{p.leading}</span> : r.note && <span className="text-[13.5px] text-muted">{r.note}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="p-2.5">
                    <strong className="lc-d text-[20px] font-semibold text-ink">{r.main}</strong>
                  </td>
                  <td className="whitespace-nowrap p-2.5">{r.second}</td>
                  <td className="whitespace-nowrap py-3 pl-2.5 pr-5 text-right font-bold">{r.third}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(p.total || p.more) && (
        <p className="m-0 border-t border-[#EEEFF2] px-5 pb-4 pt-3 text-[14px] text-muted">
          {p.total && (
            <>
              {p.totalLabel} <strong className="text-ink">{p.total}</strong>
            </>
          )}
          {p.total && p.more && " · "}
          {p.more && (
            <Link href={p.more.href} scroll={false} className="font-bold text-primary">
              {p.more.label} →
            </Link>
          )}
        </p>
      )}
    </section>
  );
}

const TAG: Record<ClaimStatus, string> = {
  not_claimed: "bg-[#F0F1F4] text-[#3A3C45]",
  claimed: "bg-[#FFEDD5] text-[#9A3412]",
  contacted: "bg-[#E8F0FE] text-[#1553B7]",
  delivered: "bg-[#E3F3EA] text-[#14633C]",
};

function StatusTag({ status, t }: { status: ClaimStatus; t: T }) {
  return <span className={cx("whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12.5px] font-bold", TAG[status])}>{t(`admin.monthly.claims.statuses.${status}`)}</span>;
}

function whoLine(r: AdminReward, t: T, fmt: (n: number) => string) {
  return r.kind === "smartphone" ? t("admin.monthly.claims.clientLine", { n: fmt(r.stats.contests ?? 0) }) : t("admin.monthly.claims.designerLine", { n: fmt(r.stats.wins ?? 0) });
}

function statusLine(r: AdminReward, t: T, fmt: (n: number) => string, when: (d: Date) => string, day: (d: Date) => string) {
  if (r.status === "delivered" && r.deliveredAt) return t("admin.monthly.claims.deliveredOn", { date: day(r.deliveredAt) });
  if (r.status === "contacted" && r.contactedAt) return t("admin.monthly.claims.calledOn", { date: when(r.contactedAt) });
  if (r.status === "claimed" && r.claimedAt) return t("admin.monthly.claims.claimedOn", { date: when(r.claimedAt) });
  return r.reminderCount ? t("admin.monthly.claims.reminders", { n: fmt(r.reminderCount) }) : t("admin.monthly.claims.noReminder");
}
