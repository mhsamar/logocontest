import Link from "next/link";
import type { Translate } from "@/lib/i18n/translate";

/**
 * The monthly prizes section under the live contests (owner, 2026-10-11; Design/rewards/home-hero-offer-slide.html). Left, for
 * business owners (smartphone, red); right, for designers (gift box, cream). Both drawings are CSS, as in the design.
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
          <span className="relative block h-[232px] w-[124px] rotate-[8deg] rounded-[26px] bg-[#111216] shadow-[0_24px_40px_rgba(0,0,0,.35)]">
            <span className="absolute inset-[7px] flex items-center justify-center rounded-[20px] bg-[linear-gradient(160deg,#FFE27A,#F6A93A)]">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="#111216">
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.5 6.6-.8z" />
              </svg>
            </span>
            <span className="absolute left-[38%] right-[38%] top-[13px] h-[7px] rounded-[9px] bg-[#111216]" />
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
          <span className="relative block h-[178px] w-[170px] -rotate-6 [filter:drop-shadow(0_22px_26px_rgba(92,10,12,.28))]">
            <span className="absolute bottom-0 left-2 right-2 top-[62px] rounded-[6px_6px_14px_14px] bg-[#8B0000]" />
            <span className="absolute left-0 right-0 top-[34px] h-9 rounded-[10px] bg-[#A30F0F]" />
            <span className="absolute bottom-0 left-1/2 top-[34px] -ml-[13px] w-[26px] bg-[#D08A1E]" />
            <span className="absolute left-1/2 top-0 -ml-12 h-[38px] w-[46px] rounded-[50%_50%_0_50%] border-[9px] border-[#D08A1E]" />
            <span className="absolute left-1/2 top-0 ml-0.5 h-[38px] w-[46px] rounded-[50%_50%_50%_0] border-[9px] border-[#D08A1E]" />
          </span>
        </div>
      </section>
      )}
    </>
  );
}
