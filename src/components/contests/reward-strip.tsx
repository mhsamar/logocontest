import Link from "next/link";
import { GiftBox, Phone } from "@/components/home/prize-panel";
import { cx } from "@/lib/cx";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { raceTally } from "@/lib/rewards/leaderboard";
import { visibleOffers } from "@/lib/rewards/visible";
import { daysLeft } from "@/lib/rewards/race-rules";
import { monthKey } from "@/lib/rewards/rules";

/**
 * The right side of the short hero on the contest list pages (owner, 2026-10-11; Design/contest-pages): the monthly
 * prizes, with the same real numbers as the monthly rewards. Hidden while that prize is switched off.
 */

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Guests: "For clients · Win a smartphone" and "For designers · Win a gift box", both to the leaderboard. */
export async function OfferCards({ t }: { t: Translate }) {
  const on = await visibleOffers();
  const cards = [
    on.smartphone && { key: "offerPhone" as const, phone: true },
    on.giftBox && { key: "offerGift" as const, phone: false },
  ].filter((c): c is { key: "offerPhone" | "offerGift"; phone: boolean } => Boolean(c));
  if (!cards.length) return null;
  return (
    <div className={cx("grid gap-3", cards.length > 1 && "min-[641px]:grid-cols-2")}>
      {cards.map((c) => (
        <Link
          key={c.key}
          href="/leaderboard"
          className={cx(
            "relative flex min-h-[150px] flex-col justify-between gap-2.5 overflow-hidden rounded-[20px] p-4 transition-opacity hover:opacity-95",
            c.phone ? "bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] text-white" : "bg-[linear-gradient(135deg,#FFF1CF,#FFE2A6)] text-[#111216]",
          )}
        >
          <div className="relative z-10 flex max-w-[66%] flex-col items-start gap-1.5">
            <span className={cx("rounded-full px-2.5 py-[3px] text-[12.5px] font-bold", c.phone ? "bg-white/[0.16]" : "bg-[rgba(17,18,22,.08)]")}>{t(`browse.x.${c.key}.pill`)}</span>
            <strong className="lc-d text-xl leading-[1.1] tracking-[-0.03em]">{t(`browse.x.${c.key}.title`)}</strong>
            <span className={cx("text-[13.5px] leading-[1.35]", c.phone ? "text-[#F6DAD8]" : "text-[#4A3700]")}>{t(`browse.x.${c.key}.body`)}</span>
          </div>
          <span className={cx("relative z-10 inline-flex items-center gap-1.5 text-sm font-bold", c.phone ? "text-[#FFE27A]" : "text-primary")}>
            {t(`browse.x.${c.key}.link`)}
            <Arrow />
          </span>
          <span aria-hidden className={cx("absolute right-[4%] top-1/2 -translate-y-1/2", c.phone ? "origin-right scale-[.42]" : "origin-right scale-[.4]")}>
            <span className="block animate-float-soft motion-reduce:animate-none">{c.phone ? <Phone /> : <GiftBox />}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Signed-in designer (gift box) or client (smartphone): their own number, the leader's, and how many more to lead. */
export async function RacePanel({ kind, userId, t, locale }: { kind: "smartphone" | "gift_box"; userId: string; t: Translate; locale: Locale }) {
  const phone = kind === "smartphone";
  const on = await visibleOffers();
  if (!(phone ? on.smartphone : on.giftBox)) return null;
  const now = new Date();
  const month = monthKey(now);
  const tally = await raceTally(month);
  const fmt = (n: number) => formatNumber(n, locale);
  const mine = (phone ? tally.clients[userId] : tally.designers[userId]) ?? 0;
  const leader = phone ? (tally.topClient?.contests ?? 0) : (tally.topDesigner?.wins ?? 0);
  const leading = (phone ? tally.topClient?.id : tally.topDesigner?.id) === userId && mine > 0;
  const need = Math.max(1, leader - mine + 1);
  const days = daysLeft(month, now);
  const tiles = [
    { label: t(phone ? "browse.x.panel.yourContests" : "browse.x.panel.yourWins"), value: fmt(mine), mine: true },
    { label: t(phone ? "browse.x.panel.topClient" : "browse.x.panel.topDesigner"), value: fmt(leader) },
    { label: t("browse.x.panel.toLead"), value: leading ? t("browse.x.panel.leading") : t("browse.x.panel.more", { n: fmt(need) }) },
  ];
  return (
    <div
      className={cx(
        "relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-[22px] p-[18px]",
        phone ? "bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] text-white" : "bg-[linear-gradient(135deg,#FFF1CF,#FFE2A6)] text-[#111216]",
      )}
    >
      <div className="flex flex-wrap gap-1.5 pr-24 text-[12.5px] font-bold max-[640px]:pr-0">
        <span className={cx("rounded-full px-2.5 py-[3px]", phone ? "bg-[#FFE27A] text-[#111216]" : "bg-primary text-white")}>{t(phone ? "browse.x.panel.phone" : "browse.x.panel.gift")}</span>
        <span className={cx("rounded-full px-2.5 py-[3px]", phone ? "bg-white/[0.16]" : "bg-[rgba(17,18,22,.08)]")}>
          {days <= 1 ? t("browse.x.panel.lastDay") : t("browse.x.panel.daysLeft", { n: fmt(days) })}
        </span>
      </div>
      <p className="lc-d m-0 pr-28 text-[17px] font-semibold leading-[1.2] tracking-[-0.02em] max-[640px]:pr-0">{t(phone ? "browse.x.panel.phoneLine" : "browse.x.panel.giftLine")}</p>
      <div className="grid grid-cols-3 gap-1.5 pr-28 max-[640px]:pr-0">
        {tiles.map((x) => (
          <div key={x.label} className={cx("flex min-w-0 flex-col rounded-xl px-2.5 py-1.5", x.mine ? (phone ? "bg-[#FFE27A] text-[#111216]" : "bg-primary text-white") : phone ? "bg-white/[0.13]" : "bg-white")}>
            <span className={cx("truncate text-[12px] font-bold", x.mine ? (phone ? "text-[#4A3700]" : "text-[#F6DAD8]") : phone ? "text-[#F6DAD8]" : "text-muted")}>{x.label}</span>
            <strong className="lc-d truncate text-lg leading-tight">{x.value}</strong>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 pr-28 max-[640px]:pr-0">
        <span role="img" aria-label={`${fmt(mine)} / ${fmt(leader)}`} className={cx("h-1.5 flex-1 overflow-hidden rounded-full", phone ? "bg-white/20" : "bg-[rgba(17,18,22,.1)]")}>
          <span className={cx("block h-full rounded-full", phone ? "bg-[#FFE27A]" : "bg-primary")} style={{ width: `${leader ? Math.min(100, Math.round((mine / leader) * 100)) : 0}%` }} />
        </span>
        <Link href="/leaderboard" className={cx("inline-flex items-center gap-1 text-[13.5px] font-bold", phone ? "text-[#FFE27A]" : "text-primary")}>
          {t("browse.x.panel.leaderboard")}
          <Arrow />
        </Link>
      </div>
      <span aria-hidden className="absolute -right-2 top-1/2 origin-right -translate-y-1/2 scale-[.5] max-[640px]:hidden">
        <span className="block animate-float-soft motion-reduce:animate-none">{phone ? <Phone /> : <GiftBox />}</span>
      </span>
    </div>
  );
}
