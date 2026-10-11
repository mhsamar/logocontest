/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/ui/panel";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { pastMonthWinners, publicRace, raceMonths, type PastWinners, type PublicPerson } from "@/lib/rewards/leaderboard";
import { daysLeft } from "@/lib/rewards/race-rules";
import { isMonthKey, monthKey, monthRange } from "@/lib/rewards/rules";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("leaderboard.metaTitle"), description: t("leaderboard.metaDescription") };
}

/** Rows shown before "See the full list". */
const SHORT = 5;
/** Midday on the 1st of a month, for its name. */
const monthDate = (month: string) => new Date(monthRange(month).start.getTime() + 12 * 3600 * 1000);
const monthName = (month: string, locale: Locale, withYear: boolean) =>
  withYear ? formatDate(monthDate(month), locale, "month") : new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", timeZone: "Asia/Dhaka" }).format(monthDate(month));

/** A round photo, or the person's first letter when there is none (never a sample photo). */
function Face({ p, size, ring = false }: { p: PublicPerson; size: number; ring?: boolean }) {
  const style = { width: size, height: size };
  return p.avatarUrl ? (
    <img src={p.avatarUrl} alt="" style={style} className={cx("block flex-none rounded-full object-cover object-[50%_20%]", ring && "border-[3px] border-white")} />
  ) : (
    <span style={style} className={cx("lc-d flex flex-none items-center justify-center rounded-full bg-[#F0F1F4] font-semibold text-[#3A3C45]", size > 48 ? "text-[20px]" : "text-[17px]", ring && "border-[3px] border-white")}>
      {p.name.replace(/^@/, "").charAt(0).toUpperCase()}
    </span>
  );
}

type Row = PublicPerson & { score: number; unit: string; sub: string };

/** One race (clients or designers), as in the design: rank, face, name, a bar against the leader, the number. */
function RaceList({
  title,
  lead,
  prize,
  tone,
  rows,
  totalText,
  more,
  showAll,
  leadingLabel,
  empty,
}: {
  title: string;
  lead: string;
  prize: string;
  tone: "red" | "gold";
  rows: Row[];
  totalText: string;
  more: { href: string; label: string } | null;
  showAll: boolean;
  leadingLabel: string;
  empty: string;
}) {
  const top = rows[0]?.score || 1;
  const shown = showAll ? rows : rows.slice(0, SHORT);
  const c = tone === "red" ? { soft: "#FDF6F5", strong: "#8B0000" } : { soft: "#FFF8E6", strong: "#B26B00" };
  return (
    <section className="min-w-0 overflow-hidden rounded-[24px] border border-[#E9EAEE] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3.5 pt-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 text-[23px] font-semibold tracking-[-0.03em]">{title}</h2>
          <span className="text-[14.5px] text-[#5F626B]">{lead}</span>
        </div>
        <span className="rounded-full px-3 py-[5px] text-[13.5px] font-bold" style={{ background: c.soft, color: c.strong }}>
          {prize}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="m-0 border-t border-[#EEEFF2] px-5 py-8 text-center text-[15px] text-[#5F626B]">{empty}</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {shown.map((r, i) => (
            <li key={`${r.name}-${i}`} className="flex items-center gap-3 border-t border-[#EEEFF2] px-3.5 py-3 sm:px-5" style={i === 0 ? { background: c.soft } : undefined}>
              <span
                className="lc-d flex size-[30px] flex-none items-center justify-center rounded-[9px] text-[15px] font-semibold"
                style={i === 0 ? { background: c.strong, color: "#fff" } : { background: "#F0F1F4", color: "#3A3C45" }}
              >
                {i + 1}
              </span>
              <Face p={r} size={44} />
              <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5">
                  <strong className="min-w-0 break-words text-[16.5px]">
                    {r.name}
                    {i === 0 && <span className="ml-1.5 whitespace-nowrap rounded-full bg-[#E3F3EA] px-[9px] py-0.5 text-[12.5px] font-bold text-[#14633C]">{leadingLabel}</span>}
                  </strong>
                  <span className="text-[14px] text-[#5F626B]">{r.sub}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#ECEDF0]" role="img" aria-label={`${r.score} ${r.unit}`}>
                  <span className="block h-full rounded-full" style={{ width: `${Math.max(6, Math.round((r.score / top) * 100))}%`, background: i === 0 ? c.strong : "#B9BCC4" }} />
                </div>
              </div>
              <div className="w-[62px] flex-none text-right">
                <strong className="lc-d block text-[24px] font-semibold leading-none tracking-[-0.03em]">{r.score}</strong>
                <span className="text-[12.5px] font-bold text-[#5F626B]">{r.unit}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEEFF2] px-5 py-3.5 text-[14.5px] text-[#5F626B]">
        <span>{totalText}</span>
        {more && (
          <Link href={more.href} scroll={false} className="font-bold text-[#8B0000]">
            {more.label}
          </Link>
        )}
      </div>
    </section>
  );
}

function PastCard({ w, t, locale }: { w: PastWinners; t: Translate; locale: Locale }) {
  const fmt = (n: number) => formatNumber(n, locale);
  return (
    <article className="flex flex-col gap-2.5 rounded-[24px] border border-[#E9EAEE] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="lc-d m-0 text-[19px] font-semibold tracking-[-0.02em]">{monthName(w.month, locale, true)}</h3>
        <span className="rounded-full bg-[#F0F1F4] px-2.5 py-[3px] text-[12.5px] font-bold text-[#3A3C45]">{t("leaderboard.closed")}</span>
      </div>
      {w.smartphone && (
        <div className="flex items-center gap-3 rounded-[14px] bg-[#FBECEB] p-3">
          <Face p={w.smartphone} size={52} ring />
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#8B0000]">{t("leaderboard.past.client")}</span>
            <strong className="truncate text-[17px]">{w.smartphone.name}</strong>
            <span className="text-[14px] text-[#5F626B]">{t("leaderboard.past.clientLine", { n: fmt(w.smartphone.contests), prize: formatTaka(w.smartphone.prizeTotal, locale) })}</span>
          </div>
        </div>
      )}
      {w.giftBox && (
        <div className="flex items-center gap-3 rounded-[14px] bg-[#FFF1CF] p-3">
          <Face p={w.giftBox} size={52} ring />
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.05em] text-[#8A5A00]">{t("leaderboard.past.designer")}</span>
            <strong className="truncate text-[17px]">{w.giftBox.name}</strong>
            <span className="text-[14px] text-[#5F626B]">{t("leaderboard.past.designerLine", { n: fmt(w.giftBox.wins) })}</span>
          </div>
        </div>
      )}
    </article>
  );
}

// P-07 Leaderboard (owner, 2026-10-11; Design/rewards/leaderboard.html): who is winning this month's smartphone and gift box.
export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const now = new Date();
  const current = monthKey(now);
  const months = await raceMonths(current, 6);
  const month = typeof sp.month === "string" && isMonthKey(sp.month) && months.includes(sp.month) ? sp.month : current;
  const isNow = month === current;
  const full = sp.full === "clients" || sp.full === "designers" ? sp.full : null;
  const [race, past] = await Promise.all([publicRace(month), pastMonthWinners(3)]);
  const fmt = (n: number) => formatNumber(n, locale);
  const href = (m: string, f: string | null = null) => {
    const q = [m !== current && `month=${m}`, f && `full=${f}`].filter(Boolean).join("&");
    return q ? `/leaderboard?${q}` : "/leaderboard";
  };
  const more = (which: "clients" | "designers", total: number) =>
    full === which ? { href: href(month), label: t("leaderboard.showFewer") } : total > SHORT ? { href: href(month, which), label: t("leaderboard.seeFull") } : null;
  const counts = [
    { n: race.counts.contestsPosted, label: t("leaderboard.counts.posted") },
    { n: race.counts.clientsInRace, label: t("leaderboard.counts.clients") },
    { n: race.counts.contestsWon, label: t("leaderboard.counts.won") },
    { n: race.counts.designersWithWin, label: t("leaderboard.counts.designers") },
  ];
  const leading = isNow ? t("leaderboard.leading") : t("leaderboard.winner");

  return (
    <PageShell className="pt-3.5">
      <div className="mx-auto flex w-full max-w-[1384px] flex-col gap-5">
        {/* Red header: the month, days left, month tabs and the month's counts */}
        <section className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-[28px] bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] px-[18px] py-[22px] text-white sm:px-[34px] sm:py-[30px]">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col items-start gap-2.5">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#FFE27A] px-3 py-[5px] text-[13.5px] font-bold text-[#111216]">{t("leaderboard.badge", { month: monthName(month, locale, true) })}</span>
              <span className="rounded-full bg-white/[0.16] px-3 py-[5px] text-[13.5px] font-bold">{isNow ? t("leaderboard.daysLeft", { n: fmt(daysLeft(month, now)) }) : t("leaderboard.closed")}</span>
            </div>
            <h1 className="m-0 text-[clamp(30px,3.8vw,50px)] font-semibold leading-[1.05] tracking-[-0.045em]">{t("leaderboard.title")}</h1>
            <p className="m-0 max-w-[560px] text-[17px] text-[#F6DAD8]">{t("leaderboard.lead")}</p>
            {months.length > 1 && (
              <nav aria-label={t("leaderboard.monthTabs")} className="mt-1 flex flex-wrap gap-1.5">
                {months.map((m) => (
                  <Link
                    key={m}
                    href={href(m)}
                    scroll={false}
                    aria-current={m === month ? "page" : undefined}
                    className={cx("inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-bold", m === month ? "bg-white text-[#8B0000]" : "border border-white/35 text-white")}
                  >
                    {m === current ? t("leaderboard.thisMonth") : monthName(m, locale, false)}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex min-w-0 flex-[1_1_420px] items-center gap-[18px]">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-[#FFE27A]">{isNow ? t("leaderboard.soFar") : t("leaderboard.thatMonth")}</span>
              <dl className="m-0 flex flex-wrap gap-2">
                {counts.map((c) => (
                  <div key={c.label} className="flex flex-[1_1_110px] flex-col-reverse gap-px rounded-[14px] bg-white/[0.13] px-3.5 py-3">
                    <dt className="text-[13.5px] font-semibold text-[#F6DAD8]">{c.label}</dt>
                    <dd className="lc-d m-0 text-[28px] font-semibold leading-[1.05] tracking-[-0.03em]">{fmt(c.n)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* The phone drawing from the design (hidden on phones) */}
            <div className="hidden w-[92px] flex-none [container-type:inline-size] sm:block" aria-hidden>
              <span className="lc-bob relative block h-[141.36cqw] w-[76cqw] rotate-[8deg] rounded-[15.96cqw] bg-[#111216] shadow-[0_4cqw_7cqw_rgba(0,0,0,.4)]">
                <span className="absolute inset-[1.1cqw] flex items-center justify-center rounded-[12.16cqw] bg-[linear-gradient(160deg,#FFE27A,#F6A93A)]">
                  <svg className="h-auto w-[45%]" viewBox="0 0 24 24" fill="#111216">
                    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" />
                  </svg>
                </span>
                <span className="absolute left-[38%] right-[38%] top-[2.2cqw] h-[1.1cqw] rounded-[2cqw] bg-[#111216]" />
              </span>
            </div>
          </div>
        </section>

        {/* The two races */}
        <div className="grid items-start gap-5 min-[1021px]:grid-cols-2">
          <RaceList
            title={t("leaderboard.clients.title")}
            lead={t("leaderboard.clients.lead")}
            prize={t("leaderboard.clients.prize")}
            tone="red"
            rows={race.clients.map((c) => ({ ...c, score: c.contests, unit: t("leaderboard.clients.unit"), sub: t("leaderboard.clients.prizeMoney", { amount: formatTaka(c.prizeTotal, locale) }) }))}
            totalText={t("leaderboard.clients.total", { n: fmt(race.clients.length) })}
            more={more("clients", race.clients.length)}
            showAll={full === "clients"}
            leadingLabel={leading}
            empty={t("leaderboard.clients.empty")}
          />
          <RaceList
            title={t("leaderboard.designers.title")}
            lead={t("leaderboard.designers.lead")}
            prize={t("leaderboard.designers.prize")}
            tone="gold"
            rows={race.designers.map((d) => ({ ...d, score: d.wins, unit: t("leaderboard.designers.unit"), sub: t("leaderboard.designers.joined", { n: fmt(d.joined) }) }))}
            totalText={t("leaderboard.designers.total", { n: fmt(race.designers.length) })}
            more={more("designers", race.designers.length)}
            showAll={full === "designers"}
            leadingLabel={leading}
            empty={t("leaderboard.designers.empty")}
          />
        </div>

        {/* Winners of past months */}
        <section className="flex flex-col gap-3" aria-labelledby="lb-past">
          <h2 id="lb-past" className="m-0 text-[26px] font-semibold tracking-[-0.035em]">
            {t("leaderboard.past.title")}
          </h2>
          {past.length === 0 ? (
            <p className="m-0 rounded-[24px] border border-[#E9EAEE] bg-white px-5 py-6 text-[15.5px] text-[#5F626B]">
              {t("leaderboard.past.empty", { date: formatDate(new Date(monthRange(current).end.getTime() - 60_000), locale, "long") })}
            </p>
          ) : (
            <div className="grid gap-4 min-[1021px]:grid-cols-3">
              {past.map((w) => (
                <PastCard key={w.month} w={w} t={t} locale={locale} />
              ))}
            </div>
          )}
        </section>

        {/* Join in, with the short rules (the full rules page comes before launch) */}
        <section id="rules" className="flex flex-wrap items-center justify-between gap-3.5 rounded-[24px] border border-[#E9EAEE] bg-white px-5 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-0.5">
            <strong className="lc-d text-[20px] tracking-[-0.02em]">{t("leaderboard.join.title")}</strong>
            <span className="text-[15.5px] text-[#5F626B]">{t("leaderboard.join.lead")}</span>
            <ul className="m-0 mt-2 flex list-disc flex-col gap-0.5 pl-5 text-[14.5px] text-[#3A3C45]">
              <li>{t("leaderboard.rules.client")}</li>
              <li>{t("leaderboard.rules.designer")}</li>
              <li>{t("leaderboard.rules.month")}</li>
            </ul>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <Link href="/start" className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#B3201B,#8B0000)] px-[22px] text-[16px] font-bold text-white">
              {t("leaderboard.join.start")}
            </Link>
            <Link href="/designers/signup" className="inline-flex min-h-[50px] items-center justify-center rounded-full border border-[#DCDEE3] bg-white px-5 text-[16px] font-bold text-[#111216]">
              {t("leaderboard.join.designer")}
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
