/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { monthLabel } from "@/lib/notifications/render";
import type { MyReward } from "@/lib/rewards/claims";

/**
 * "You won" on the dashboard while a monthly prize waits for its claim (owner, 2026-10-11; step 1 "on the profile"):
 * the card, the prize and month, and the claim button. Red for the smartphone, gold for the gift box.
 */
export async function PrizeBanner({ rewards }: { rewards: MyReward[] }) {
  if (!rewards.length) return null;
  const { t, locale } = await getI18n();
  return (
    <div className="space-y-3">
      {rewards.map((r) => {
        const phone = r.kind === "smartphone";
        return (
          <section
            key={r.id}
            className={cx(
              "flex items-center gap-3.5 rounded-[22px] p-3.5 sm:gap-5 sm:p-4",
              phone ? "bg-[linear-gradient(150deg,#A30F0F,#8B0000_52%,#4A0709)] text-white" : "bg-[linear-gradient(150deg,#FFF3D6,#FFDF9C)] text-[#111216]",
            )}
          >
            <img src={r.thumb} alt="" width={1080} height={1080} className="size-[76px] flex-none rounded-[14px] object-cover shadow-[0_6px_16px_rgba(0,0,0,.22)] sm:size-[92px]" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h2 className="m-0 text-[18px] font-semibold leading-tight tracking-[-0.02em] sm:text-[21px]">
                  {t(phone ? "monthlyReward.banner.smartphone" : "monthlyReward.banner.giftBox", { month: monthLabel(r.month, locale) })}
                </h2>
                <p className={cx("m-0 mt-0.5 text-[14.5px]", phone ? "text-[#F6DAD8]" : "text-[#4A3700]")}>{t("monthlyReward.banner.lead")}</p>
              </div>
              <Link
                href={`/dashboard/rewards/${r.id}`}
                className={cx("inline-flex min-h-11 shrink-0 items-center rounded-full px-5 text-[15px] font-bold", phone ? "bg-white text-[#8B0000]" : "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white")}
              >
                {t(phone ? "monthlyReward.page.claimSmartphone" : "monthlyReward.page.claimGiftBox")}
              </Link>
            </div>
          </section>
        );
      })}
    </div>
  );
}
