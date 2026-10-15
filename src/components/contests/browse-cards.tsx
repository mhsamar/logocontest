import Link from "next/link";
import type { ContestRow, DesignerFacts } from "@/lib/contests/browse";
import { ENDING_SOON_DAYS } from "@/lib/contests/browse-query";
import { cx } from "@/lib/cx";
import { formatDate, timeAgo } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { BrandTile, ContestNumber, PackagePill } from "./contest-bits";
import { isFinished } from "@/lib/contests/public-statuses";
import { SaveButton } from "./save-button";
import { categoryLabel } from "@/lib/contests/browse-query";

/**
 * Browse Contests cards (owner, 2026-10-11; Design/contest-pages). Paid add-ons show together: Featured = gold
 * border and a gold tag on the top edge with a filled button, Urgent = a red line on the top edge and a red badge,
 * Highlighted = a soft yellow card, Private / NDA = the lock tile, a black badge and a fixed line instead of the brief.
 * A private contest's name and brief never reach the page.
 */

const DAY = 86_400_000;
/** `price`: a taka amount in the visitor's currency (owner, 2026-10-14: US dollars for visitors from abroad). */
type Ctx = { t: Translate; locale: Locale; now: Date; price?: (bdt: number) => string };

/** Name and brief are hidden for private contests and for NDA contests the viewer hasn't unlocked. */
export const isHidden = (c: ContestRow, unlocked = false) => c.isPrivate || (c.isNda && !unlocked);

const Dot = () => <span aria-hidden className="size-[7px] flex-none rounded-full bg-[#C0161F]" />;
const Star = ({ className = "size-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" />
  </svg>
);
const Arrow = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BADGE = "inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12.5px] font-bold";

export function AddonBadges({ c, t, now, featured = true }: { c: ContestRow; t: Translate; now: Date; featured?: boolean }) {
  const soon = c.status === "open" && c.endsAt && c.endsAt.getTime() - now.getTime() <= ENDING_SOON_DAYS * DAY && c.endsAt > now;
  return (
    <>
      {featured && c.isPromoted && <span className={cx(BADGE, "bg-[#FFF1CF] text-[#8A5A00]")}>{t("browse.x.badge.featured")}</span>}
      {c.isUrgent && (
        <span className={cx(BADGE, "gap-1.5 bg-[#FDE3E1] text-[#A3121B]")}>
          <Dot />
          {t("browse.x.badge.urgent")}
        </span>
      )}
      {c.isHighlighted && <span className={cx(BADGE, "bg-[#FFF4D1] text-[#6B4E00]")}>{t("browse.x.badge.highlighted")}</span>}
      {(c.isPrivate || c.isNda) && <span className={cx(BADGE, "bg-[#111216] text-white")}>{t("browse.x.badge.privateNda")}</span>}
      {soon && <span className={cx(BADGE, "bg-[#FFEDD5] text-[#9A3412]")}>{t("browse.x.badge.endingSoon")}</span>}
    </>
  );
}

/** The status line of a contest that no longer takes designs. */
function StatusText({ c, t, locale, now }: Ctx & { c: ContestRow }) {
  const line = c.status === "judging" ? t("browse.line.judging", { date: formatDate(c.judgingEndsAt ?? c.endsAt ?? now, locale, "short") }) : t(`browse.line.${c.status as "completed"}`);
  return <strong className="text-ink">{line}</strong>;
}

/** Designs and designers, and "28 days left" with its progress line; orange at three days or less. */
function Counts({ c, t, locale, now, bar }: Ctx & { c: ContestRow; bar: boolean }) {
  const fmt = (n: number) => formatNumber(n, locale);
  const designers = c.faces.total;
  const open = c.status === "open" && c.endsAt;
  const ms = open ? c.endsAt!.getTime() - now.getTime() : 0;
  const soon = open && ms <= ENDING_SOON_DAYS * DAY;
  const total = open && c.startsAt ? c.endsAt!.getTime() - c.startsAt.getTime() : 0;
  const done = total > 0 ? Math.min(1, Math.max(0, 1 - ms / total)) : 0;
  const days = !open
    ? null
    : ms <= 0
      ? t("home.card.ended")
      : ms < DAY
        ? t("home.card.hoursLeft", { hours: fmt(Math.ceil(ms / 3_600_000)) })
        : t("home.card.daysLeft", { days: fmt(Math.ceil(ms / DAY)) });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap justify-between gap-x-2.5 gap-y-1 text-sm text-muted">
        <span>
          <strong className="text-ink">{fmt(c.entries)}</strong> {t(c.entries === 1 ? "browse.featuredCard.designOne" : "browse.featuredCard.designs")} ·{" "}
          <strong className="text-ink">{fmt(designers)}</strong> {t(designers === 1 ? "browse.featuredCard.designerOne" : "browse.featuredCard.designers")}
        </span>
        {open ? <strong className={soon ? "text-[#9A3412]" : "text-ink"}>{days}</strong> : <StatusText c={c} t={t} locale={locale} now={now} />}
      </div>
      {bar && open && (
        <div role="img" aria-label={days ?? ""} className="h-1.5 overflow-hidden rounded-full bg-[#ECEDF0]">
          <span className={cx("block h-full rounded-full", soon ? "bg-[#D9480F]" : "bg-primary")} style={{ width: `${Math.round(done * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function PrizeRow({ c, t, locale, price, label, filled, size }: { c: ContestRow; t: Translate; locale: Locale; price?: (bdt: number) => string; label: string; filled: boolean; size: "lg" | "md" }) {
  return (
    <div className="flex items-end justify-between gap-2.5 border-t border-[#EEEFF2] pt-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[12.5px] font-bold text-muted">{t("browse.featuredCard.prize")}</span>
        <strong className={cx("lc-d leading-[1.05] tracking-[-0.03em] text-primary", size === "lg" ? "text-[30px]" : "text-[28px]")}>{price ? price(c.prize) : formatTaka(c.prize, locale)}</strong>
      </div>
      <Link
        href={`/contest/${c.slug}`}
        className={cx(
          "relative z-10 inline-flex min-h-11 flex-none items-center gap-1.5 rounded-full px-[18px] text-[15px] font-bold transition-opacity hover:opacity-90",
          filled ? "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white" : "bg-[#FBECEB] text-primary",
        )}
      >
        {label}
        <Arrow />
      </Link>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-[#F4F5F7] px-3 py-2">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <span className="truncate text-[13.5px] font-bold text-ink">{value}</span>
    </div>
  );
}

/** One contest in the "All contests" grid. `facts` and `saved` are set only for signed-in designers. */
export function ContestCard({ c, t, locale, now, price, designer, facts, saved }: Ctx & { c: ContestRow; designer: boolean; facts?: DesignerFacts; saved?: boolean }) {
  const hidden = isHidden(c, facts?.unlocked);
  const title = hidden ? t("home.card.privateTitle") : c.brandName;
  const meta = [categoryLabel(c, t, locale), c.startsAt && t("browse.started", { ago: timeAgo(c.startsAt, now, locale) })].filter(Boolean).join(" · ");
  const label = designer && c.status === "open" ? t("browse.x.viewSubmit") : t("browse.x.view");
  const fmt = (n: number) => formatNumber(n, locale);
  return (
    <article
      className={cx(
        // Fills its grid cell whatever the text length (owner, 2026-10-16: a short description left a gap).
        "relative flex w-full min-w-0 flex-col gap-3 rounded-[20px] border p-4",
        c.isHighlighted ? "bg-[#FFFBEA]" : "bg-white",
        c.isPromoted ? "border-2 border-[#E2B13C] shadow-[0_10px_26px_rgba(208,138,30,.14)]" : c.isHighlighted ? "border-[#F1E3A8]" : "border-[#E9EAEE]",
      )}
    >
      {c.isUrgent && <span aria-hidden className={cx("absolute inset-x-5 h-1 rounded-b-md bg-[#C0161F]", c.isPromoted ? "-top-0.5" : "-top-px")} />}
      {c.isPromoted && (
        <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(180deg,#F0C24F,#D9A52B)] px-[11px] py-[3px] text-[12.5px] font-bold text-[#3A2A00] shadow-[0_4px_10px_rgba(208,138,30,.3)]">
          <Star className="size-3" />
          {t("browse.x.badge.featured")}
        </span>
      )}
      <div className="flex items-start gap-3">
        <BrandTile name={hidden ? "" : c.brandName} isPrivate={hidden} cover={hidden ? null : c.cover} className="size-[60px] !rounded-2xl text-[0.7rem]" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="lc-d m-0 min-w-0 text-[19px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
              {/* The whole card opens the contest; buttons inside stay their own. */}
              <Link href={`/contest/${c.slug}`} className="after:absolute after:inset-0 after:rounded-[20px]">
                {title}
              </Link>
            </h3>
            <ContestNumber n={c.number} t={t} locale={locale} />
          </div>
          <span className="text-sm text-muted">{meta}</span>
        </div>
        {saved !== undefined && (saved || !isFinished(c.status)) && <SaveButton contestId={c.id} saved={saved} className="relative z-10 -mr-1 -mt-1 shrink-0" />}
      </div>
      <div className="flex min-h-[22px] flex-wrap gap-1.5">
        {facts && facts.mine > 0 && (
          <span className={cx(BADGE, "bg-[#E3F3EA] text-[#14633C]")}>{facts.mine === 1 ? t("browse.x.badge.youSentOne") : t("browse.x.badge.youSent", { n: fmt(facts.mine) })}</span>
        )}
        <AddonBadges c={c} t={t} now={now} />
        <PackagePill pkg={c.package} t={t} />
      </div>
      <p className="m-0 line-clamp-2 min-h-[44px] text-[14.5px] leading-normal text-muted">{hidden ? t(designer ? "browse.x.privateLineDesigner" : "browse.x.privateLine") : c.description}</p>
      {facts && (
        <div className="grid grid-cols-2 gap-2">
          <Fact label={t("browse.x.facts.style")} value={!facts.unlocked ? t("browse.x.facts.hidden") : facts.styles.length ? facts.styles.map((s) => t(`wizard.styles.${s}`)).join(", ") : "—"} />
          <Fact
            label={t("browse.x.facts.colours")}
            value={
              !facts.unlocked ? (
                t("browse.x.facts.hidden")
              ) : facts.colors.length ? (
                <span className="flex items-center gap-1">
                  {facts.colors.slice(0, 5).map((hex) => (
                    <span key={hex} title={hex} className="size-4 rounded-full ring-1 ring-black/10" style={{ background: hex }} />
                  ))}
                </span>
              ) : (
                t("browse.x.facts.choose")
              )
            }
          />
          <Fact label={t("browse.x.facts.seen")} value={facts.clientSeen ? timeAgo(facts.clientSeen, now, locale) : t("browse.x.facts.notYet")} />
          <Fact
            label={t("browse.x.facts.yours")}
            value={
              facts.mine === 0
                ? t("browse.x.facts.none")
                : facts.best
                  ? t("browse.x.facts.sentBest", { n: fmt(facts.mine), r: fmt(facts.best) })
                  : t("browse.x.facts.sent", { n: fmt(facts.mine) })
            }
          />
        </div>
      )}
      <div className="mt-auto flex flex-col gap-3">
        <PrizeRow c={c} t={t} locale={locale} price={price} label={label} filled={c.isPromoted} size="md" />
        <Counts c={c} t={t} locale={locale} now={now} bar />
      </div>
    </article>
  );
}

/** A large card in "Featured contests": cover with the Featured tag (and Urgent), then the details. */
export function FeaturedContestCard({ c, t, locale, now, price, designer }: Ctx & { c: ContestRow; designer: boolean }) {
  const hidden = isHidden(c);
  const label = designer ? t("browse.x.viewSubmit") : t("browse.x.view");
  return (
    <article className="relative flex w-full min-w-0 flex-col gap-3 rounded-[24px] border border-[#E9EAEE] bg-white p-2.5 pb-4 shadow-[0_10px_26px_rgba(17,18,22,.06)]">
      <div className="relative h-[150px] overflow-hidden rounded-2xl">
        <BrandTile name={hidden ? "" : c.brandName} isPrivate={hidden} cover={hidden ? null : c.cover} flat className="size-full text-[1.6rem]" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#111216]">
          <Star className="size-3" />
          {t("browse.x.badge.featured")}
        </span>
        {c.isUrgent && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-[#C0161F] px-3 py-1 text-[13px] font-bold text-white">
            <span className="size-[7px] rounded-full bg-white" />
            {t("browse.x.badge.urgent")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5 px-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <PackagePill pkg={c.package} t={t} />
          <ContestNumber n={c.number} t={t} locale={locale} />
        </div>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="lc-d m-0 truncate text-[21px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
              <Link href={`/contest/${c.slug}`} className="after:absolute after:inset-0 after:rounded-[24px]">
                {hidden ? t("home.card.privateTitle") : c.brandName}
              </Link>
            </h3>
            <span className="text-[14.5px] text-muted">{categoryLabel(c, t, locale)}</span>
          </div>
          <div className="flex max-w-[56%] flex-wrap justify-end gap-1.5">
            <AddonBadges c={c} t={t} now={now} featured={false} />
          </div>
        </div>
        <PrizeRow c={c} t={t} locale={locale} price={price} label={label} filled size="lg" />
        <Counts c={c} t={t} locale={locale} now={now} bar={false} />
      </div>
    </article>
  );
}
