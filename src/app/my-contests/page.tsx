/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandTile, ContestNumber } from "@/components/contests/contest-bits";
import { PageShell, Panel } from "@/components/ui/panel";
import { WinnerTrophy } from "@/components/ui/trophy";
import { getCurrentUser } from "@/lib/auth/session";
import { getMyContests, journeyStep, type MyContest } from "@/lib/contests/my-contests";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { timeLeft } from "@/lib/home/logo-pick";
import type { Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("myContests.metaTitle"), robots: { index: false } };
}

const Arrow = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** The newest designs as a fan of cards (or a "designs are on the way" card while there are none). */
function DesignFan({ c, t, fmt }: { c: MyContest; t: Translate; fmt: (n: number) => string }) {
  const shown = c.latest.slice(0, 3);
  // Left, middle (on top), right: the side cards lean out so all three show.
  const tilt = ["-translate-x-[68%] translate-y-[4%] -rotate-[11deg] scale-[0.9]", "z-10 -translate-y-[3%]", "translate-x-[68%] translate-y-[4%] rotate-[11deg] scale-[0.9]"];
  const order = shown.length === 1 ? [1] : shown.length === 2 ? [0, 2] : [0, 1, 2];
  return (
    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[26px] bg-[radial-gradient(120%_90%_at_50%_100%,#fff1e6,#f6f2ee_55%,#efeae6)]">
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <span className="relative flex size-14 items-center justify-center rounded-2xl bg-white text-primary shadow-card">
            <span className="absolute -right-1 -top-1 size-3 animate-ping rounded-full bg-primary/50" aria-hidden />
            <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3" />
            </svg>
          </span>
          <p className="m-0 max-w-[16rem] text-[15px] font-semibold text-ink">{t("myContests.waiting")}</p>
        </div>
      ) : (
        shown.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={cx("absolute aspect-square w-[40%] rounded-[18px] bg-white object-cover shadow-[0_18px_40px_rgb(17_18_22/0.18)] ring-4 ring-white transition-transform duration-500", tilt[order[i]])}
          />
        ))
      )}
      {c.entries > shown.length && shown.length > 0 && (
        <span className="absolute bottom-3 right-3 z-20 rounded-full bg-ink/85 px-3 py-1 text-[13px] font-bold text-white">{t("myContests.more", { n: fmt(c.entries - shown.length) })}</span>
      )}
    </div>
  );
}

/** Getting designs → Pick a winner → Final files → Done. */
function Journey({ step, t }: { step: number; t: Translate }) {
  const steps = ["designs", "pick", "files", "done"] as const;
  return (
    <ol className="m-0 grid list-none grid-cols-4 gap-1.5 p-0" aria-label={t("myContests.journey.label")}>
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < step ? "past" : n === step ? "now" : "next";
        return (
          <li key={s} aria-current={state === "now" ? "step" : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span className={cx("h-1.5 rounded-full", state === "next" ? "bg-line" : "bg-primary", state === "now" && "animate-pulse")} />
            <span className={cx("text-[12.5px] font-semibold leading-tight", state === "now" ? "text-primary" : state === "past" ? "text-ink" : "text-muted")}>{t(`myContests.journey.${s}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** What happens next, in one line. */
function NextLine({ c, t, locale, now }: { c: MyContest; t: Translate; locale: Locale; now: Date }) {
  if (c.status === "open") {
    const left = timeLeft(c.endsAt, now);
    if (!left) return <>{t("myContests.next.closing")}</>;
    return <>{left.kind === "hours" ? t("myContests.next.hours", { n: formatNumber(left.n, locale) }) : t("myContests.next.days", { n: formatNumber(left.n, locale) })}</>;
  }
  if (c.status === "judging") return <>{c.judgingEndsAt ? t("myContests.next.pickBy", { date: formatDate(c.judgingEndsAt, locale, "short") }) : t("myContests.next.pick")}</>;
  return <>{t("myContests.next.files")}</>;
}

function Spotlight({ c, t, locale, now }: { c: MyContest; t: Translate; locale: Locale; now: Date }) {
  const fmt = (n: number) => formatNumber(n, locale);
  const step = journeyStep(c.status);
  return (
    <article className="grid gap-5 rounded-[32px] bg-surface p-4 shadow-[0_1px_2px_rgb(17_18_22/0.04),0_20px_50px_rgb(17_18_22/0.07)] ring-1 ring-line sm:p-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
      <DesignFan c={c} t={t} fmt={fmt} />
      <div className="flex min-w-0 flex-col gap-4 lg:pr-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold", step === 1 ? "bg-[#e3f3ea] text-[#14633c]" : "bg-[#fff6d6] text-gold-ink")}>
            <span className={cx("size-1.5 rounded-full", step === 1 ? "bg-[#14633c]" : "bg-gold-ink")} />
            {t(`myContests.state.${step === 1 ? "live" : step === 2 ? "pick" : "files"}`)}
          </span>
          <ContestNumber n={c.number} t={t} locale={locale} />
        </div>
        <h3 className="m-0 truncate text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">{c.brandName}</h3>
        <p className="m-0 text-[17px] font-semibold text-primary">
          <NextLine c={c} t={t} locale={locale} now={now} />
        </p>
        <Journey step={step} t={t} />
        <dl className="m-0 grid grid-cols-3 gap-2">
          {[
            { label: t("myContests.stat.designs"), value: fmt(c.entries) },
            { label: t("myContests.stat.designers"), value: fmt(c.designers) },
            { label: t("myContests.stat.prize"), value: formatTaka(c.prize, locale) },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-[16px] bg-chip px-3 py-2.5">
              <dt className="text-[12.5px] font-medium text-muted">{s.label}</dt>
              <dd className="m-0 truncate text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
        {c.unrated > 0 && (
          <p className="m-0 inline-flex items-center gap-2 self-start rounded-full bg-tint px-3 py-1.5 text-[13.5px] font-bold text-primary">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-white">{fmt(c.unrated)}</span>
            {t("myContests.toRate", { n: fmt(c.unrated) })}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/contests/${c.slug}`} className="lc-g inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-[image:var(--gradient-red)] px-5 text-[15.5px] font-bold text-white">
            {t(step === 1 || step === 2 ? "myContests.review" : "myContests.openFiles")}
            <Arrow />
          </Link>
          <Link href={`/contest/${c.slug}`} className="inline-flex min-h-12 items-center rounded-[14px] px-4 text-[15px] font-bold text-ink ring-1 ring-line hover:ring-primary">
            {t("myContests.publicPage")}
          </Link>
        </div>
      </div>
    </article>
  );
}

// P-14 My contests (owner, 2026-10-11): the client's contests at a glance, with its own look (not the dashboard).
export default async function MyContestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent("/my-contests")}`);
  if (user.role !== "client") redirect("/contests");
  const [{ t, locale }, my] = await Promise.all([getI18n(), getMyContests(user.id)]);
  const now = new Date();
  const fmt = (n: number) => formatNumber(n, locale);
  const first = (my.name || user.name).trim().split(/\s+/)[0];
  const empty = my.running.length + my.drafts.length + my.done.length === 0;

  return (
    <PageShell>
      {/* Banner */}
      <section className="relative overflow-hidden rounded-[32px] bg-[image:var(--gradient-red-dark)] px-6 py-8 text-white sm:px-10 sm:py-11 max-[720px]:rounded-[24px]">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-white/[0.06]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-24 right-40 size-56 rounded-full bg-white/[0.05]" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-white/85">
              <span className="size-1.5 rounded-full bg-[#ffd36b]" />
              {t("myContests.eyebrow")}
            </p>
            <h1 className="m-0 mt-3 text-[clamp(32px,4.4vw,54px)] font-semibold leading-[1.02] tracking-[-0.04em]">{t("myContests.title", { name: first })}</h1>
            <p className="m-0 mt-2 text-[17px] text-white/75">{t(my.totals.live ? "myContests.leadLive" : "myContests.leadQuiet")}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <dl className="m-0 grid grid-cols-3 gap-2 sm:gap-2.5">
              {[
                { label: t("myContests.totals.live"), value: my.totals.live },
                { label: t("myContests.totals.designs"), value: my.totals.designs },
                { label: t("myContests.totals.won"), value: my.totals.won },
              ].map((s) => (
                <div key={s.label} className="flex min-w-[5.5rem] flex-col-reverse rounded-[18px] bg-white/10 px-4 py-3 ring-1 ring-white/10">
                  <dt className="text-[12.5px] font-medium text-white/70">{s.label}</dt>
                  <dd className="m-0 text-[28px] font-semibold tabular-nums leading-tight tracking-[-0.03em]">{fmt(s.value)}</dd>
                </div>
              ))}
            </dl>
            <Link href="/start" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-white px-5 text-[15.5px] font-bold text-primary transition-transform hover:-translate-y-0.5">
              <span aria-hidden className="text-xl leading-none">+</span>
              {t("myContests.new")}
            </Link>
          </div>
        </div>
      </section>

      {empty ? (
        <Panel className="flex flex-col items-center gap-4 text-center">
          <span className="text-5xl" aria-hidden>
            ✏️
          </span>
          <h2 className="m-0 text-[28px] font-semibold tracking-[-0.03em] text-ink">{t("myContests.empty.title")}</h2>
          <p className="m-0 max-w-md text-muted">{t("myContests.empty.body")}</p>
          <Link href="/start" className="lc-g inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-[image:var(--gradient-red)] px-6 font-bold text-white">
            {t("myContests.new")}
            <Arrow />
          </Link>
        </Panel>
      ) : (
        <>
          {my.running.length > 0 && (
            <section className="flex flex-col gap-4" aria-labelledby="mc-running">
              <h2 id="mc-running" className="m-0 px-2 text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.03em] text-ink">
                {t("myContests.running")}
              </h2>
              {my.running.map((c) => (
                <Spotlight key={c.id} c={c} t={t} locale={locale} now={now} />
              ))}
            </section>
          )}

          {my.drafts.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="mc-drafts">
              <h2 id="mc-drafts" className="m-0 px-2 text-[clamp(20px,2.2vw,24px)] font-semibold tracking-[-0.03em] text-ink">
                {t("myContests.drafts")}
              </h2>
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {my.drafts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/start?draft=${c.id}`} className="flex items-center gap-3 rounded-[22px] border-2 border-dashed border-line bg-surface/70 p-3.5 transition-colors hover:border-primary">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-chip text-xl font-bold text-muted">{c.brandName.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-[16px] text-ink">{c.brandName}</strong>
                        <span className="block text-[13.5px] text-muted">{t(c.status === "pending_payment" ? "myContests.draftPay" : "myContests.draftFinish")}</span>
                      </span>
                      <span className="text-primary">
                        <Arrow />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {my.done.length > 0 && (
            <section className="rounded-[32px] bg-surface p-5 sm:p-8 max-[720px]:rounded-[24px]" aria-labelledby="mc-shelf">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="mc-shelf" className="m-0 text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.03em] text-ink">
                  {t("myContests.shelf")}
                </h2>
                <p className="m-0 text-[14px] text-muted">{t("myContests.shelfLead")}</p>
              </div>
              <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
                {my.done.map((c) => {
                  const won = c.status === "completed" && c.cover?.isWinner;
                  return (
                    <li key={c.id}>
                      <Link href={`/dashboard/contests/${c.slug}`} className="group flex flex-col gap-2.5">
                        <span className={cx("relative block aspect-square overflow-hidden rounded-[22px] bg-white ring-1 transition-transform duration-300 group-hover:-translate-y-1", won ? "ring-[3px] ring-[#e9c46a] shadow-[0_14px_34px_rgb(201_149_18/0.25)]" : "ring-line")}>
                          <BrandTile name={c.brandName} isPrivate={false} cover={c.cover} flat className="h-full w-full text-[2rem]" />
                          {won && <WinnerTrophy className="absolute right-2 top-2" />}
                        </span>
                        <span className="px-1">
                          <strong className="block truncate text-[15.5px] text-ink">{c.brandName}</strong>
                          <span className="block text-[13px] text-muted">
                            {c.status === "completed" ? t("myContests.wonOn", { date: c.completedAt ? formatDate(c.completedAt, locale, "month") : "" }) : t("myContests.noResult")}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <p className="m-0 px-2 text-center text-[14px] text-muted">
            {t("myContests.fullTools")}{" "}
            <Link href="/dashboard" className="font-bold text-primary hover:underline">
              {t("myContests.toDashboard")}
            </Link>
          </p>
        </>
      )}
    </PageShell>
  );
}
