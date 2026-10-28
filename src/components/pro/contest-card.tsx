import Link from "@/components/ui/link";
import { SaveButton } from "@/components/contests/save-button";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import type { MiniContest } from "@/lib/pro/workspace";
import { durationText, Icon } from "./parts";
import { contestTypeLabel, leftText } from "./pro-dashboard";

/** One contest in the Pro workspace: early-access and invited ones are marked, with the time before others see it. */
export function ProContestCard({ c, saved, invited, names, t, locale, price }: { c: MiniContest; saved: boolean | null; invited: boolean; names: Map<string, string>; t: Translate; locale: Locale; price?: (bdt: number) => string }) {
  const early = Boolean(c.opensToAll);
  const letters = (c.brand ?? "").replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  return (
    <article className={`pr-cc${early ? " early" : invited ? " inv" : ""}`}>
      {c.isPrivate ? (
        <div className="top lock">
          <Icon name="lock" size={24} />
          {t("pro.contests.privateContest")}
        </div>
      ) : (
        <div className="top" aria-hidden>
          {letters || <Icon name="trophy" size={30} />}
        </div>
      )}
      {early ? (
        <span className="tag">
          <Icon name="bolt" size={12} />
          {t("pro.contests.earlyBadge")}
        </span>
      ) : invited ? (
        <span className="tag inv">
          <Icon name="invite" size={12} />
          {t("pro.contests.invitedBadge")}
        </span>
      ) : null}
      <div className="bd">
        <b>{c.brand ?? t("pro.contests.privateContest")}</b>
        <div className="meta">
          <span className="prize">{price ? price(c.prize) : formatTaka(c.prize, locale)}</span>
          <span>{contestTypeLabel(c, t, names)}</span>
          <span>{t("pro.contests.left", { time: leftText(c.endsAt, t) })}</span>
          <span>{c.entries === 1 ? t("pro.contests.oneDesign") : t("pro.contests.designs", { n: formatNumber(c.entries, locale) })}</span>
        </div>
        {c.opensToAll && (
          <span className="others">
            <Icon name="clock" size={14} />
            {t("pro.contests.othersIn", { time: durationText((c.opensToAll.getTime() - new Date().getTime()) / 60_000, t) })}
          </span>
        )}
        <div className="act">
          <Link href={`/contest/${c.slug}/submit`} className="pr-btn sm">
            {t("pro.contests.send")}
          </Link>
          {saved !== null && <SaveButton contestId={c.id} saved={saved} />}
        </div>
      </div>
    </article>
  );
}
