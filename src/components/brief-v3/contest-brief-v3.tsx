import "./brief-v3.css";
import Link from "@/components/ui/link";
import type { BriefUpdate } from "@/lib/brief-v3/store";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { BriefText } from "./brief-text";
import { PhotoStrip } from "./photo-strip";
import { dayLabel, whenLabel } from "./when";

/** "৪ দিন", "৫ ঘণ্টা" or "শেষ" until the contest stops taking designs. */
export function timeLeft(endsAt: Date | null, t: Translate, locale: Locale, now: Date = new Date()): string {
  if (!endsAt) return "—";
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return t("briefV3.view.ended");
  const days = Math.floor(ms / 86_400_000);
  return days >= 1 ? t("briefV3.view.days", { n: formatNumber(days, locale) }) : t("briefV3.view.hours", { n: formatNumber(Math.max(1, Math.ceil(ms / 3_600_000)), locale) });
}

/** The client's newest update, in yellow at the top (owner, 2026-11-08). */
export function LatestUpdate({ update, t, locale }: { update: BriefUpdate | undefined; t: Translate; locale: Locale }) {
  if (!update) return null;
  return (
    <div className="b3-card yellow" style={{ gap: 6 }}>
      <span className="text-[12px] font-bold text-[#8A6A00]">{t("briefV3.view.newUpdate", { when: dayLabel(update.createdAt, t, locale) })}</span>
      <span className="whitespace-pre-line break-words text-[14.5px]">{update.text}</span>
    </div>
  );
}

/**
 * The brief on the contest page's Brief tab (owner, 2026-11-08; Design/logocontest-onboarding ContestBrief): a dark red
 * card with the category, logo name, prize, time left and designs; the newest update; the brief with its headings in
 * bold red and the client's pictures (full size on a tap); every update; and "Submit a design". Nothing personal about
 * the client is shown here.
 */
export function ContestBriefV3(props: {
  brandName: string;
  category: string | null;
  prize: number;
  endsAt: Date | null;
  entries: number;
  text: string;
  photos: { url: string; name: string }[];
  updates: BriefUpdate[];
  submitHref: string | null;
  t: Translate;
  locale: Locale;
}) {
  const { t, locale } = props;
  return (
    <div className="b3 mx-auto max-w-[640px]">
      <div className="b3-card b3-head">
        <span className="b3-head-label">{props.category ? t("briefV3.view.label", { category: props.category }) : t("briefV3.view.labelPlain")}</span>
        <strong className="b3-head-name">{props.brandName}</strong>
        <div className="b3-stats">
          <div className="b3-stat">
            <span>{t("briefV3.view.prize")}</span>
            <strong className="gold">{formatTaka(props.prize, locale)}</strong>
          </div>
          <div className="b3-stat">
            <span>{t("briefV3.view.left")}</span>
            <strong>{timeLeft(props.endsAt, t, locale)}</strong>
          </div>
          <div className="b3-stat">
            <span>{t("briefV3.view.designs")}</span>
            <strong>{t("briefV3.view.designCount", { n: formatNumber(props.entries, locale) })}</strong>
          </div>
        </div>
      </div>

      <LatestUpdate update={props.updates[0]} t={t} locale={locale} />

      <div className="b3-card">
        <p className="b3-lbl">{t("briefV3.view.brief")}</p>
        <BriefText text={props.text} small />
        {props.photos.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="b3-mut text-[12.5px]">{t("briefV3.view.photos")}</span>
            <PhotoStrip photos={props.photos} />
          </div>
        )}
      </div>

      {props.updates.length > 1 && (
        <div className="b3-card" style={{ gap: 10 }}>
          <p className="b3-lbl">{t("briefV3.view.updates")}</p>
          <ul className="b3-updates">
            {props.updates.map((u) => (
              <li key={u.id}>
                <span className="b3-dot" aria-hidden />
                <div className="flex min-w-0 flex-col">
                  <span className="whitespace-pre-line break-words text-[14px]">{u.text}</span>
                  <span className="b3-mut text-[12px]">{whenLabel(u.createdAt, t, locale)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {props.submitHref && (
        <div className="flex flex-col gap-2">
          <Link href={props.submitHref} className="b3-btn flex items-center justify-center no-underline">
            {t("briefV3.view.submit")}
          </Link>
          <span className="b3-mut text-center text-[12.5px]">{t("briefV3.view.note")}</span>
        </div>
      )}
    </div>
  );
}
