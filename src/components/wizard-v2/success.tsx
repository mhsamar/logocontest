"use client";

import { ButtonLink } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { useI18n } from "@/lib/i18n/client";

/**
 * After the bKash ID was sent (spec §2): thanks, and the optional brief, already filled in from the business type.
 * The contest goes live when the payment is approved, with or without the brief.
 */
export function DoneV2({ contestId, slug, brandName }: { contestId: string; slug: string; brandName: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
      <h1 className="m-0 mt-5 text-[clamp(24px,3vw,32px)] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">{t("wizardV2.done.heading")}</h1>
      <p className="m-0 mt-3 text-[16px] leading-relaxed text-muted">{t("wizardV2.done.body", { name: brandName })}</p>
      <div className="mt-7 flex w-full flex-col gap-3">
        <ButtonLink href={`/start-v2/brief?c=${contestId}`} size="lg" block>
          {t("wizardV2.done.brief")}
        </ButtonLink>
        <Link href={slug ? `/client/contests/${slug}` : "/client/contests"} className="min-h-11 py-2 text-sm font-semibold text-primary underline">
          {t("wizardV2.done.later")}
        </Link>
      </div>
    </div>
  );
}
