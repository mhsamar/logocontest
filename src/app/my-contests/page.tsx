import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandTile, ContestNumber } from "@/components/contests/contest-bits";
import { RacePanel } from "@/components/contests/reward-strip";
import { getCurrentUser } from "@/lib/auth/session";
import { getContact } from "@/lib/content/contact";
import { getMyContests, type MyContest } from "@/lib/contests/my-contests";
import { cx } from "@/lib/cx";
import { formatDate, timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import type { Locale } from "@/lib/i18n/config";
import { aiConfigured } from "@/lib/logo-check/ai";
import { contestChecks } from "@/lib/logo-check/queries";
import { contestServiceInfo } from "@/lib/services/contest-service";
import { formatNumber, formatTaka } from "@/lib/money";
import { offersOn } from "@/lib/rewards/program";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("myContests.metaTitle"), robots: { index: false } };
}

const DAY = 86_400_000;
const TABS = ["all", "open", "pick", "unpaid", "done"] as const;
type Tab = (typeof TABS)[number];
const SORTS = ["action", "newest", "ending"] as const;
type Sort = (typeof SORTS)[number];
type State = "open" | "pick" | "unpaid" | "files" | "done";

/** Which of the four looks a contest gets (owner, 2026-10-11; Design/contest-pages/my-contests-client.html). */
const stateOf = (status: string): State =>
  status === "open" ? "open" : status === "judging" ? "pick" : status === "draft" || status === "pending_payment" ? "unpaid" : status === "winner_selected" || status === "handover" ? "files" : "done";
const tabOf = (s: State): Exclude<Tab, "all"> => (s === "files" ? "done" : s);

const CARD = "rounded-[24px] border border-[#E9EAEE] bg-white";
const BTN = "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-[22px] text-base font-bold transition-opacity hover:opacity-90";
const RED = "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white";

const Arrow = ({ className = "size-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BADGE: Record<State, string> = {
  open: "bg-[#E3F3EA] text-[#14633C]",
  pick: "bg-[#FFF1CF] text-[#8A5A00]",
  unpaid: "bg-[#FDE3E1] text-[#A3121B]",
  files: "bg-[#FFF4D1] text-[#6B4E00]",
  done: "bg-[#F0F1F4] text-[#3A3C45]",
};

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback);

// P-14 My contests (redesign owner 2026-10-11, Design/contest-pages): a short hero with the smartphone race, tabs with
// real counts, "need your action", search and sort (Needs my action first), one card per contest in four looks, and a
// wide "Start a new contest" tile. Only the signed-in client's own contests.
export default async function MyContestsPage({ searchParams }: PageProps<"/my-contests">) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent("/my-contests")}`);
  if (user.role !== "client") redirect("/contests");
  const sp = await searchParams;
  const tab = pick(TABS, sp.tab, "all");
  const sort = pick(SORTS, sp.sort, "action");
  const q = (typeof sp.q === "string" ? sp.q : "").replace(/\s+/g, " ").trim().slice(0, 60);
  const [{ t, locale }, my, contact, phoneOn] = await Promise.all([getI18n(), getMyContests(user.id), getContact("en"), offersOn().then((o) => o.smartphone)]);
  const now = new Date();
  const fmt = (n: number) => formatNumber(n, locale);

  const all = [...my.running, ...my.drafts, ...my.done];
  const counts = { all: all.length, open: 0, pick: 0, unpaid: 0, done: 0 } as Record<Tab, number>;
  for (const c of all) counts[tabOf(stateOf(c.status))]++;
  const need = counts.pick + counts.unpaid;

  const rank = (c: MyContest) => ({ pick: 0, unpaid: 1, open: c.unrated > 0 ? 2 : 3, files: 4, done: 5 })[stateOf(c.status)];
  const newest = (a: MyContest, b: MyContest) => b.createdAt.getTime() - a.createdAt.getTime();
  const ends = (c: MyContest) => (c.status === "open" && c.endsAt ? c.endsAt.getTime() : Infinity);
  const words = q.toLowerCase();
  const list = all
    .filter((c) => (tab === "all" || tabOf(stateOf(c.status)) === tab) && (!words || c.brandName.toLowerCase().includes(words)))
    .sort((a, b) => (sort === "action" ? rank(a) - rank(b) || newest(a, b) : sort === "ending" ? ends(a) - ends(b) || newest(a, b) : newest(a, b)));

  // The AI logo check line (owner, 2026-10-14): used and left on every logo contest that can still be checked (open,
  // judging, final files). Logo contests only (owner, 2026-10-13: other contest services have no AI logo check).
  const checkable = (s: string) => ["open", "pick", "files"].includes(stateOf(s));
  const services = aiConfigured() ? await contestServiceInfo(list.filter((c) => checkable(c.status)).map((c) => c.id)) : new Map();
  const checks = aiConfigured()
    ? new Map(
        await Promise.all(
          list
            .filter((c) => checkable(c.status) && (services.get(c.id)?.service ?? "logo") === "logo")
            .map(async (c) => [c.id, await contestChecks({ id: c.id, prize: c.prize, logoScan: c.logoScan, status: c.status })] as const),
        ),
      )
    : new Map();

  const href = (change: Partial<{ tab: Tab; sort: Sort; q: string }>) => {
    const next = { tab, sort, q, ...change };
    const p = new URLSearchParams();
    if (next.tab !== "all") p.set("tab", next.tab);
    if (next.sort !== "action") p.set("sort", next.sort);
    if (next.q) p.set("q", next.q);
    const s = p.toString();
    return s ? `/my-contests?${s}` : "/my-contests";
  };

  const openN = counts.open;
  const pickN = counts.pick;
  const openText = openN === 1 ? t("myContests.x.openOne") : t("myContests.x.openMany", { n: fmt(openN) });
  const pickText = pickN === 1 ? t("myContests.x.pickOne") : t("myContests.x.pickMany", { n: fmt(pickN) });
  const lead =
    openN && pickN
      ? t("myContests.x.lead", { open: openText, pick: pickText })
      : openN
        ? t("myContests.x.leadOpen", { open: openText })
        : pickN
          ? t("myContests.x.leadPick", { pick: pickText })
          : t("myContests.leadQuiet");

  // The wide "Start a new contest" tile fills the rest of the last row.
  const n = list.length;
  const rest3 = 3 - (n % 3);
  const rest2 = 2 - (n % 2);
  const span = cx(
    "col-span-1",
    rest2 === 2 ? "min-[641px]:col-span-2" : "min-[641px]:col-span-1",
    rest3 === 3 ? "min-[1101px]:col-span-3" : rest3 === 2 ? "min-[1101px]:col-span-2" : "min-[1101px]:col-span-1",
  );

  return (
    <div className="flex w-full flex-1 flex-col gap-5 px-3.5 pb-3.5 max-[720px]:gap-3 max-[720px]:px-2 max-[720px]:pb-2">
      {/* Short hero */}
      <section className={cx(CARD, "px-7 py-[22px] max-[640px]:px-4 max-[640px]:py-5")}>
        <div className="grid items-center gap-7 min-[1101px]:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <div className="flex min-w-0 flex-col items-start gap-2">
            <span className="rounded-full bg-[#FBECEB] px-3 py-1 text-[13.5px] font-bold text-primary">{t("myContests.eyebrow")}</span>
            <h1 className="lc-d m-0 text-[clamp(28px,2.9vw,40px)] font-semibold leading-[1.06] tracking-[-0.04em] text-ink">{t("myContests.x.title")}</h1>
            <p className="m-0 max-w-[560px] text-[16.5px] text-muted">{lead}</p>
            <div className="mt-1 flex flex-wrap gap-2 max-[640px]:w-full max-[640px]:flex-col">
              <Link href="/start" className={cx(BTN, RED)}>
                {t("browse.hero.cta")}
                <Arrow className="size-[18px]" />
              </Link>
              <Link href="/how-it-works" className={cx(BTN, "border border-[#DCDEE3] bg-white text-ink")}>
                {t("browse.hero.how")}
              </Link>
            </div>
          </div>
          <RacePanel kind="smartphone" userId={user.id} t={t} locale={locale} />
        </div>
      </section>

      {all.length === 0 ? (
        <section className={cx(CARD, "mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-12 text-center")}>
          <h2 className="lc-d m-0 text-2xl font-semibold text-ink">{t("myContests.empty.title")}</h2>
          <p className="m-0 text-muted">{t("myContests.empty.body")}</p>
          <Link href="/start" className={cx(BTN, RED)}>
            {t("browse.hero.cta")}
            <Arrow />
          </Link>
        </section>
      ) : (
        <>
          {/* Control row */}
          <div className="flex flex-wrap items-center gap-2.5 max-[640px]:flex-col max-[640px]:items-stretch">
            <nav aria-label={t("myContests.eyebrow")} className="max-w-full overflow-x-auto [scrollbar-width:none]">
              <ul className="m-0 flex w-max list-none gap-1 rounded-full border border-[#E9EAEE] bg-white p-1">
                {TABS.map((k) => {
                  const active = k === tab;
                  return (
                    <li key={k}>
                      <Link
                        href={href({ tab: k })}
                        aria-current={active ? "page" : undefined}
                        className={cx("flex min-h-10 items-center gap-2 rounded-full px-4 text-[15px] font-bold max-[640px]:px-2.5 max-[640px]:text-[14.5px]", active ? "bg-[#111216] text-white" : "text-[#3A3C45] hover:text-ink")}
                      >
                        {t(`myContests.x.tabs.${k}`)}
                        <span className={cx("rounded-full px-2 text-[12.5px]", active ? "bg-white/20 text-white" : "bg-[#F0F1F4] text-[#3A3C45]")}>{fmt(counts[k])}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {need > 0 && (
              <Link
                href={href({ sort: "action", tab: "all" })}
                className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-[#F6D4B0] bg-[#FFF3E6] px-3.5 text-[14.5px] font-bold text-[#9A3412]"
              >
                <span aria-hidden className="size-[7px] rounded-full bg-[#D9480F]" />
                {need === 1 ? t("myContests.x.needOne") : t("myContests.x.needMany", { n: fmt(need) })}
              </Link>
            )}
            <form action="/my-contests" role="search" className="flex h-[46px] min-w-[160px] flex-[1_1_160px] items-center max-[640px]:flex-none gap-2.5 rounded-xl border border-[#DCDEE3] bg-white px-3.5 text-muted">
              {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
              {sort !== "action" && <input type="hidden" name="sort" value={sort} />}
              <svg viewBox="0 0 24 24" className="size-[18px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input type="search" name="q" defaultValue={q} maxLength={60} aria-label={t("myContests.x.search")} placeholder={t("myContests.x.search")} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
            </form>
          </div>
          <nav aria-label={t("myContests.x.sort.label")} className="-mt-1 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="mr-1 font-bold text-ink">{t("myContests.x.sort.label")}:</span>
            {SORTS.map((s) => (
              <Link
                key={s}
                href={href({ sort: s })}
                aria-current={s === sort ? "true" : undefined}
                className={cx("inline-flex min-h-9 items-center rounded-full border px-3 font-bold", s === sort ? "border-[#111216] bg-[#111216] text-white" : "border-[#E3E4E8] bg-white text-[#3A3C45] hover:border-primary")}
              >
                {t(`myContests.x.sort.${s}`)}
              </Link>
            ))}
          </nav>

          <ul className="m-0 grid list-none items-stretch gap-4 p-0 min-[641px]:grid-cols-2 min-[1101px]:grid-cols-3">
            {list.map((c) => (
              <li key={c.id} className="flex">
                <MyCard c={c} t={t} locale={locale} now={now} phone={contact.phone} phoneHref={contact.phoneHref} checks={checks.get(c.id)?.checkable ? { used: checks.get(c.id)!.used, left: checks.get(c.id)!.left, limit: checks.get(c.id)!.limit } : null} />
              </li>
            ))}
            <li className={cx("flex", span)}>
              <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-4 rounded-[24px] border-2 border-dashed border-[#D9DBE0] px-6 py-8 text-center sm:text-left">
                <span aria-hidden className="flex size-12 flex-none items-center justify-center rounded-full bg-[#FBECEB] text-2xl font-semibold text-primary">
                  +
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <strong className="lc-d text-xl tracking-[-0.02em] text-ink">{t("myContests.x.newTitle")}</strong>
                  <span className="text-[14.5px] text-muted">{phoneOn ? t("myContests.x.newBody") : t("myContests.x.newBodyPlain")}</span>
                </div>
                <Link href="/start" className={cx(BTN, RED)}>
                  {t("browse.hero.cta")}
                </Link>
              </div>
            </li>
          </ul>
          {list.length === 0 && <p className="m-0 -mt-2 text-center text-muted">{t("myContests.x.noMatch")}</p>}
        </>
      )}
    </div>
  );
}

/** One of the client's contests: badge, grey note, dashed helper line and button change with its state. */
function MyCard({ c, t, locale, now, phone, phoneHref, checks }: { c: MyContest; t: Translate; locale: Locale; now: Date; phone: string; phoneHref: string; checks: { used: number; left: number; limit: number } | null }) {
  const fmt = (n: number) => formatNumber(n, locale);
  const state = stateOf(c.status);
  const manage = `/dashboard/contests/${c.slug}`;
  const meta =
    state === "unpaid"
      ? t("myContests.x.draftAgo", { ago: timeAgo(c.createdAt, now, locale) })
      : state === "pick" && c.endsAt
        ? t("myContests.x.ended", { ago: timeAgo(c.endsAt, now, locale) })
        : state === "done" && c.completedAt
          ? t("myContests.wonOn", { date: formatDate(c.completedAt, locale, "short") })
          : c.startsAt
            ? t("browse.started", { ago: timeAgo(c.startsAt, now, locale) })
            : null;
  const missing = [
    !c.isPromoted && ["featured", "bg-[#FFF1CF] text-[#8A5A00]"],
    !c.isUrgent && ["urgent", "bg-[#FDE3E1] text-[#A3121B]"],
    !c.isHighlighted && ["highlighted", "bg-[#FFF4D1] text-[#6B4E00]"],
  ].filter(Boolean) as [string, string][];

  const note =
    state === "open"
      ? c.unrated === 1
        ? t("myContests.x.note.openNewOne")
        : c.unrated > 1
          ? t("myContests.x.note.openNew", { n: fmt(c.unrated) })
          : t("myContests.waiting")
      : state === "pick"
        ? t("myContests.x.note.pick")
        : state === "unpaid"
          ? c.status === "draft"
            ? t("myContests.x.note.draft")
            : t("myContests.x.note.unpaid")
          : state === "files"
            ? t("myContests.next.files")
            : c.status === "no_result"
              ? t("myContests.noResult")
              : t("myContests.x.note.done");

  const button =
    state === "open"
      ? { href: manage, label: t("myContests.review"), filled: true }
      : state === "pick"
        ? { href: manage, label: t("myContests.x.pickWinner"), filled: true }
        : state === "unpaid"
          ? { href: `/start?draft=${c.id}`, label: c.status === "draft" ? t("myContests.x.finish") : t("myContests.x.pay"), filled: true }
          : state === "files"
            ? { href: manage, label: t("myContests.openFiles"), filled: false }
            : { href: manage, label: c.status === "no_result" ? t("myContests.toDashboard") : t("myContests.x.download"), filled: false };

  const ms = c.endsAt ? c.endsAt.getTime() - now.getTime() : 0;
  const total = c.startsAt && c.endsAt ? c.endsAt.getTime() - c.startsAt.getTime() : 0;
  const done = total > 0 ? Math.min(1, Math.max(0, 1 - ms / total)) : 0;
  const soon = ms <= 3 * DAY;
  const daysText = ms <= 0 ? t("home.card.ended") : ms < DAY ? t("home.card.hoursLeft", { hours: fmt(Math.ceil(ms / 3_600_000)) }) : t("home.card.daysLeft", { days: fmt(Math.ceil(ms / DAY)) });
  const right =
    state === "open" ? (
      <strong className={soon ? "text-[#9A3412]" : "text-ink"}>{daysText}</strong>
    ) : state === "pick" ? (
      <strong className="text-[#9A3412]">{c.judgingEndsAt ? t("myContests.x.pickBy", { date: formatDate(c.judgingEndsAt, locale, "short") }) : t("myContests.next.pick")}</strong>
    ) : state === "unpaid" ? (
      <strong className="text-[#A3121B]">{t("myContests.x.notLive")}</strong>
    ) : state === "done" && c.status === "completed" ? (
      <strong className="text-[#14633C]">{t("myContests.x.filesReady")}</strong>
    ) : null;
  const bar = state === "open" ? { width: done, tone: soon ? "bg-[#D9480F]" : "bg-primary" } : state === "pick" ? { width: 1, tone: "bg-[#D9480F]" } : state === "done" && c.status === "completed" ? { width: 1, tone: "bg-[#14633C]" } : null;

  return (
    <article className={cx(CARD, "flex w-full flex-col gap-3 p-4", state === "pick" && "border-2 border-[#E2B13C]")}>
      <div className="flex items-start gap-3">
        <BrandTile name={c.brandName} isPrivate={false} cover={c.cover} className="size-12 !rounded-[14px] text-[0.6rem]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="lc-d m-0 min-w-0 truncate text-[19px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">{c.brandName}</h2>
            <ContestNumber n={c.number} t={t} locale={locale} />
          </div>
          <span className="text-sm text-muted">{[t(`wizard.businessTypes.${c.businessType}`), meta].filter(Boolean).join(" · ")}</span>
        </div>
        <span className={cx("flex-none whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12.5px] font-bold", BADGE[state])}>
          {c.status === "no_result" ? t("myContests.x.badge.noResult") : t(`myContests.x.badge.${state}`)}
        </span>
      </div>

      <p className="m-0 rounded-xl bg-[#F4F5F7] px-3 py-2.5 text-[14.5px] leading-normal text-[#3A3C45]">
        {state === "open" && c.unrated > 0 && <span className="mr-1.5 inline-flex rounded-full bg-primary px-2 py-px text-[12px] font-bold text-white">{fmt(c.unrated)}</span>}
        {note}
      </p>

      {/* The dashed helper line */}
      {state === "open" && missing.length > 0 && (
        <Link href={`${manage}#addons`} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-[#E2B13C] bg-[#FFFBEA] px-3 py-2 text-[13.5px]">
          <strong className="mr-0.5 text-ink">{t("myContests.x.boost")}</strong>
          {missing.map(([k, tone]) => (
            <span key={k} className={cx("rounded-full px-2 py-px text-[12px] font-bold", tone)}>
              {t(`browse.x.badge.${k as "featured"}`)}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-primary">
            {t("myContests.x.add")}
            <Arrow className="size-3.5" />
          </span>
        </Link>
      )}
      {checks && checks.limit > 0 && (
        <Link href={manage} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-[#DCDEE3] px-3 py-2 text-[13.5px]">
          <strong className="text-ink">{t("myContests.x.aiCheck")}</strong>
          <span className="text-muted">{t("entryCheck.policy.used", { used: fmt(checks.used), left: fmt(checks.left), limit: fmt(checks.limit) })}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-primary">
            {t("myContests.x.checkLink")}
            <Arrow className="size-3.5" />
          </span>
        </Link>
      )}
      {state === "unpaid" && (
        <a href={phoneHref} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-[#DCDEE3] px-3 py-2 text-[13.5px]">
          <strong className="text-ink">{t("myContests.x.payHelp")}</strong>
          <span className="text-muted">{t("howPage.questions.call", { phone })}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-primary">
            {t("myContests.x.call")}
            <Arrow className="size-3.5" />
          </span>
        </a>
      )}
      {state === "done" && c.status === "completed" && (
        <Link href="/start" className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-[#DCDEE3] px-3 py-2 text-[13.5px]">
          <strong className="text-ink">{t("myContests.x.happy")}</strong>
          <span className="text-muted">{t("myContests.x.startNext")}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-primary">
            {t("myContests.x.start")}
            <Arrow className="size-3.5" />
          </span>
        </Link>
      )}

      <div className="mt-auto flex flex-col gap-2.5">
        <div className="flex items-end justify-between gap-2.5 border-t border-[#EEEFF2] pt-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[12.5px] font-bold text-muted">{state === "unpaid" ? t("myContests.x.willPay") : state === "done" && c.status === "completed" ? t("myContests.x.prizePaid") : t("myContests.x.prize")}</span>
            <strong className="lc-d text-[28px] leading-[1.05] tracking-[-0.03em] text-primary">{formatTaka(state === "unpaid" ? c.total : c.prize, locale)}</strong>
          </div>
          <Link href={button.href} className={cx("inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-[18px] text-[15px] font-bold transition-opacity hover:opacity-90", button.filled ? RED : "bg-[#FBECEB] text-primary")}>
            {button.label}
            <Arrow />
          </Link>
        </div>
        <div className="flex flex-wrap justify-between gap-x-2.5 gap-y-1 text-sm text-muted">
          {state === "unpaid" ? (
            <span />
          ) : (
            <span>
              <strong className="text-ink">{fmt(c.entries)}</strong> {t(c.entries === 1 ? "browse.featuredCard.designOne" : "browse.featuredCard.designs")} · <strong className="text-ink">{fmt(c.designers)}</strong>{" "}
              {t(c.designers === 1 ? "browse.featuredCard.designerOne" : "browse.featuredCard.designers")}
            </span>
          )}
          {right}
        </div>
        {bar && (
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-[#ECEDF0]">
            <span className={cx("block h-full rounded-full", bar.tone)} style={{ width: `${Math.round(bar.width * 100)}%` }} />
          </div>
        )}
      </div>
    </article>
  );
}
