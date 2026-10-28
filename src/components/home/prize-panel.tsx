import Link from "@/components/ui/link";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { raceTally } from "@/lib/rewards/leaderboard";
import { visibleOffers } from "@/lib/rewards/visible";
import { daysLeft } from "@/lib/rewards/race-rules";
import { monthKey, monthRange } from "@/lib/rewards/rules";
import { GiftBox } from "@/components/rewards/gift-art";

/**
 * "This month" on the client and designer homes (owner, 2026-10-11; Design/rewards/buyer-home-smartphone.html and
 * designer-home-gift-box.html): the gift box race for a client and for a designer (owner, 2026-10-20: no smartphone). The person's own
 * number, the leader's number, how many more to take the lead, days left and the rules. Real numbers (cached a few
 * minutes, like the leaderboard); hidden while that prize is switched off.
 */
export async function PrizePanel({ kind, userId }: { kind: "smartphone" | "gift_box"; userId: string }) {
  const phone = kind === "smartphone";
  const on = await visibleOffers();
  if (!(phone ? on.smartphone : on.giftBox)) return null;
  const now = new Date();
  const month = monthKey(now);
  const [{ t, locale }, tally] = await Promise.all([getI18n(), raceTally(month)]);
  const fmt = (n: number) => formatNumber(n, locale);
  const k = phone ? "client" : "designer";
  const mine = (phone ? tally.clients[userId] : tally.designers[userId]) ?? 0;
  const top = phone ? tally.topClient : tally.topDesigner;
  const leader = phone ? (tally.topClient?.contests ?? 0) : (tally.topDesigner?.wins ?? 0);
  const leading = top?.id === userId;
  // One more than the leader takes the lead for sure (an equal number goes to prize money / earnings).
  const need = Math.max(1, leader - mine + 1);
  const days = daysLeft(month, now);
  const monthName = new Date(monthRange(month).start.getTime() + 43_200_000).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", timeZone: "Asia/Dhaka" });
  const plural = (key: string, n: number) => t(`home.prize.${key}${n === 1 ? "One" : ""}` as Parameters<typeof t>[0]);

  const tiles = [
    { label: t(`home.prize.${k}.yours`), value: fmt(mine), small: t("home.prize.thisMonth"), mine: true },
    { label: t(`home.prize.${k}.top`), value: fmt(leader), small: leader ? plural(`${k}.soFar`, leader) : t("home.prize.nobody") },
    leading
      ? { label: t("home.prize.leadingLabel"), value: fmt(1), small: t("home.prize.leading") }
      : { label: t("home.prize.toLead"), value: fmt(need), small: plural(`${k}.more`, need) },
  ];

  return (
    <div
      className={cx(
        "relative flex min-w-0 items-center gap-3 overflow-hidden rounded-[24px] p-[22px] sm:rounded-[28px] sm:p-7",
        phone ? "bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] text-white" : "bg-[linear-gradient(135deg,#FFF1CF,#FFE2A6)] text-[#111216]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <div className="flex flex-wrap gap-2 text-[13.5px] font-bold">
          <span className={cx("rounded-full px-3 py-[5px]", phone ? "bg-[#FFE27A] text-[#111216]" : "bg-primary text-white")}>{t(`home.prize.${k}.pill`)}</span>
          <span className={cx("rounded-full px-3 py-[5px]", phone ? "bg-white/[0.16]" : "bg-[rgba(17,18,22,.08)]")}>
            {days <= 1 ? t("home.prize.lastDay", { month: monthName }) : t("home.prize.daysLeft", { month: monthName, n: fmt(days) })}
          </span>
        </div>
        <p className="lc-d m-0 pr-24 text-[clamp(24px,2.6vw,34px)] font-semibold leading-[1.1] tracking-[-0.035em] sm:pr-0">{t(`home.prize.${k}.title`)}</p>
        <div className="flex w-full flex-wrap gap-2">
          {tiles.map((x) => (
            <div
              key={x.label}
              className={cx(
                "flex flex-[1_1_120px] flex-col gap-0.5 rounded-[14px] px-3.5 py-3",
                x.mine ? (phone ? "bg-[#FFE27A] text-[#111216]" : "bg-primary text-white") : phone ? "bg-white/[0.13]" : "bg-white",
              )}
            >
              <span className={cx("text-[13px] font-bold", x.mine ? (phone ? "text-[#4A3700]" : "text-[#F6DAD8]") : phone ? "text-[#F6DAD8]" : "text-muted")}>{x.label}</span>
              <strong className="lc-d text-[26px] font-semibold leading-[1.05] tracking-[-0.03em]">{x.value}</strong>
              <span className={cx("text-[13px]", x.mine ? (phone ? "text-[#4A3700]" : "text-[#F6DAD8]") : phone ? "text-[#F6DAD8]" : "text-muted")}>{x.small}</span>
            </div>
          ))}
        </div>
        <div className="flex w-full flex-col gap-[5px]">
          <div className={cx("flex justify-between text-[13.5px] font-bold", phone ? "text-[#F6DAD8]" : "text-[#4A3700]")}>
            <span>{t(`home.prize.${k}.you${mine === 1 ? "One" : ""}`, { n: fmt(mine) })}</span>
            <span>{t(`home.prize.${k}.leader${leader === 1 ? "One" : ""}`, { n: fmt(leader) })}</span>
          </div>
          <div role="img" aria-label={t("home.prize.barLabel", { mine: fmt(mine), leader: fmt(leader) })} className={cx("h-2.5 overflow-hidden rounded-full", phone ? "bg-white/20" : "bg-[rgba(17,18,22,.1)]")}>
            <span className={cx("block h-full rounded-full", phone ? "bg-[#FFE27A]" : "bg-primary")} style={{ width: `${leader ? Math.min(100, Math.round((mine / leader) * 100)) : 0}%` }} />
          </div>
        </div>
        <div className={cx("flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[14px]", phone ? "text-[#F6DAD8]" : "text-[#4A3700]")}>
          <span>
            <strong className={phone ? "text-white" : "text-[#111216]"}>{t("home.prize.equal")}</strong> {t(`home.prize.${k}.tie`)}
          </span>
          <Link href="/leaderboard#rules" className={cx("font-bold", phone ? "text-[#FFE27A]" : "text-primary")}>
            {t("home.prize.rules")} →
          </Link>
        </div>
      </div>
      <div aria-hidden className="absolute right-1 top-2 flex-none origin-top-right scale-[.55] sm:static sm:scale-100 sm:px-3">
        <span className="block animate-float-soft motion-reduce:animate-none"><GiftBox gold={phone} /></span>
      </div>
    </div>
  );
}
