"use client";

import { useState, useTransition } from "react";
import Link from "@/components/ui/link";
import { useToast } from "@/components/ui/toast";
import { contestHref } from "@/lib/client/rules";
import type { BusinessType } from "@/lib/contests/brief";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { v2AcceptBrief } from "@/lib/onboarding/brief-actions";
import { briefOpen, type BriefCompletion } from "@/lib/onboarding/brief-defaults";

/**
 * Onboarding v2's brief banner (owner, 2026-10-29; client-onboarding-v2-spec.md §3 "After পরে করবো"): a client who left
 * the brief on its defaults after paying sees, at the top of the dashboard and the contest page (never a pop-up), how
 * ready it is, with "See the brief" (the hub) and "OK, keep it like this". Once 3 designs are in it turns green and
 * points to them instead: from then on the ratings steer the designers. Gone for good once the client keeps the brief
 * or changes any part of it.
 */

/** Designs in before the banner turns green (spec §3.4). */
export const GREEN_AT = 3;

export type BannerInput = {
  status: string;
  completion: BriefCompletion | null;
  entries: number;
  unrated: number;
  /** A bKash payment for it is waiting for approval: with "open", the only times it shows (it comes after paying). */
  waiting: boolean;
};

/**
 * Which banner a contest shows: none for an old-wizard contest, or once the brief was kept or changed; yellow while it
 * runs on the defaults; green from 3 designs while some are still unrated ("rate them" has nothing to ask after that).
 */
export function briefBanner(c: BannerInput): "brief" | "entries" | null {
  if (!c.completion || c.completion.acceptedAt || c.completion.edited.length > 0 || !briefOpen(c.status)) return null;
  // After paying only (spec §3): an unpaid draft has its own "pay to go live" card, and never a brief nag.
  if (c.status !== "open" && !c.waiting) return null;
  if (c.entries >= GREEN_AT) return c.unrated > 0 ? "entries" : null;
  return "brief";
}

export function BriefBanner(
  props: BannerInput & {
    contestId: string;
    slug: string;
    /** How ready the brief is (briefReadyPercent). */
    percent: number;
    businessType: BusinessType | "";
    /** The contest's name, on the dashboard where several contests can have one. */
    brand?: string;
  },
) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [kept, setKept] = useState(false);
  const kind = briefBanner(props);
  if (!kind || kept) return null;
  const num = (n: number) => formatNumber(n, locale);
  const brand = props.brand ? <small className="mb-0.5 block text-[13px] font-bold opacity-75">{props.brand}</small> : null;

  if (kind === "entries")
    return (
      <div className="calert ok flex flex-wrap items-center justify-between gap-3" data-brief-banner="entries">
        <span className="min-w-[min(100%,15rem)] flex-1">
          {brand}
          {t("wizardV2.banner.entries", { n: num(props.entries) })}
        </span>
        <Link href={contestHref(props.slug, "designs", { filter: "unrated" })} className="dbtn sm">
          {t("wizardV2.banner.entriesOpen")}
        </Link>
      </div>
    );

  const keep = () =>
    start(async () => {
      const res = await v2AcceptBrief({ contestId: props.contestId });
      if (!res.ok) return toast(t(res.error), "danger");
      setKept(true);
    });
  return (
    <div className="calert info flex flex-wrap items-center justify-between gap-3" data-brief-banner="brief">
      <span className="min-w-[min(100%,15rem)] flex-1">
        {brand}
        <b className="block">{t("wizardV2.banner.title", { n: num(props.percent) })}</b>
        <span className="mt-1 block text-[14.5px] font-medium">{t("wizardV2.banner.body", { type: props.businessType ? t(`wizard.businessTypes.${props.businessType}`) : "" })}</span>
      </span>
      <span className="flex flex-wrap gap-2">
        <Link href={`/start-v2/brief?c=${props.contestId}`} className="dbtn sm">
          {t("wizardV2.banner.open")}
        </Link>
        <button type="button" className="dout sm" disabled={busy} onClick={keep} data-brief-keep>
          {t("wizardV2.banner.keep")}
        </button>
      </span>
    </div>
  );
}
