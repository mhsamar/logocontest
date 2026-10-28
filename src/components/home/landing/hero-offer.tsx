import Link from "@/components/ui/link";
import { GiftBox } from "@/components/rewards/gift-art";
import type { Translate } from "@/lib/i18n/translate";

/**
 * The monthly prizes section under the live contests (owner, 2026-10-11; Design/rewards/home-hero-offer-slide.html). Left, for
 * business owners (red, a gold gift box); right, for designers (cream, a red gift box). Both drawings are CSS. Owner,
 * 2026-10-20: both prizes are gift boxes now (the smartphone is gone).
 * What the prizes are is never shown. Owner, 2026-10-13: each half only shows while its offer runs.
 */
export function HeroOffer({ t, smartphone, giftBox }: { t: Translate; smartphone: boolean; giftBox: boolean }) {
  const btn = "inline-flex min-h-[52px] items-center gap-1.5 whitespace-nowrap rounded-full font-bold";
  return (
    <>
      {smartphone && (
      <section className="lc-offer bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] text-white">
        <div className="lc-offer-text">
          <span className="self-start whitespace-nowrap rounded-full bg-white/[0.16] px-3.5 py-[5px] text-[14px] font-bold">{t("home.offer.clients.eyebrow")}</span>
          <p className="lc-offer-title m-0">
            {t("home.offer.clients.line1")}
            <br />
            {t("home.offer.clients.line2")}
          </p>
          <p className="m-0 max-w-[340px] text-[17px] text-[#F6DAD8]">{t("home.offer.clients.text")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/start" className={`${btn} bg-white px-[22px] text-[17px] text-[#8B0000]`}>
              {t("home.offer.clients.start")}
            </Link>
            <Link href="/leaderboard" className={`${btn} border-[1.5px] border-white/50 px-5 text-[16px] text-white`}>
              {t("home.offer.clients.leading")}
            </Link>
          </div>
        </div>
        <div className="lc-offer-art lc-bob [animation-delay:-2s]" aria-hidden>
          <span className="block h-[180px] w-[171px]">
            <span className="block origin-top-left scale-90">
              <GiftBox gold />
            </span>
          </span>
        </div>
      </section>
      )}
      {giftBox && (
      <section className="lc-offer bg-[#FFE9B8] text-[#111216]">
        <div className="lc-offer-text">
          <span className="self-start whitespace-nowrap rounded-full bg-[rgba(17,18,22,.08)] px-3.5 py-[5px] text-[14px] font-bold">{t("home.offer.designers.eyebrow")}</span>
          <p className="lc-offer-title m-0">
            {t("home.offer.designers.line1")}
            <br />
            {t("home.offer.designers.line2")}
          </p>
          <p className="m-0 max-w-[340px] text-[17px] text-[#4A3700]">{t("home.offer.designers.text")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/designers/signup" className={`${btn} bg-[#111216] px-[22px] text-[17px] text-white`}>
              {t("home.offer.designers.join")}
            </Link>
            <Link href="/leaderboard" className={`${btn} border-[1.5px] border-[rgba(17,18,22,.35)] px-5 text-[16px] text-[#111216]`}>
              {t("home.offer.designers.leaderboard")}
            </Link>
          </div>
        </div>
        <div className="lc-offer-art lc-bob [animation-delay:-4s]" aria-hidden>
          <span className="block h-[180px] w-[171px]">
            <span className="block origin-top-left scale-90">
              <GiftBox />
            </span>
          </span>
        </div>
      </section>
      )}
    </>
  );
}
