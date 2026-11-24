"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { countdownParts, countdownTone, countdownUsed, type CountdownTone } from "@/lib/handover/countdown";
import { useI18n } from "@/lib/i18n/client";

const TONE: Record<CountdownTone, { text: string; bar: string; ring: string }> = {
  calm: { text: "text-white", bar: "bg-gold", ring: "ring-white/20" },
  soon: { text: "text-gold", bar: "bg-gold", ring: "ring-gold/60" },
  urgent: { text: "text-[#ffb4b4]", bar: "bg-[#ff6b6b]", ring: "ring-[#ff6b6b]" },
  over: { text: "text-[#ffb4b4]", bar: "bg-[#ff6b6b]", ring: "ring-[#ff6b6b]" },
};

/**
 * The winner's delivery stopwatch (owner, 2026-11-24): a big HH:MM:SS that counts down to the first-files deadline,
 * on the red "You won" boxes. It starts from the server's time, so the first paint matches, then ticks every second.
 * `big` on the handover page, compact on the dashboard card.
 */
export function DeliveryCountdown({ deadline, totalHours, serverNow, size = "big" }: { deadline: string; totalHours: number; serverNow: string; size?: "big" | "compact" }) {
  const { t, locale } = useI18n();
  const end = new Date(deadline).getTime();
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  useEffect(() => {
    // The first tick, a second in, moves the clock from the server's time to this device's.
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = end - now;
  const tone = countdownTone(left);
  const { h, m, s } = countdownParts(left);
  const two = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN", { minimumIntegerDigits: 2, useGrouping: false }).format(n);
  const used = countdownUsed(left, totalHours * 3_600_000);
  const style = TONE[tone];
  const units = [
    { v: h, label: t("handover.countdown.hours") },
    { v: m, label: t("handover.countdown.minutes") },
    { v: s, label: t("handover.countdown.seconds") },
  ];

  if (size === "compact") {
    return (
      <span className={cx("lc-d block font-semibold tabular-nums", style.text)} data-no-fx role="timer" aria-label={t("handover.countdown.aria", { h: two(h), m: two(m) })}>
        {tone === "over" ? t("handover.countdown.over") : `⏱ ${two(h)}:${two(m)}:${two(s)}`}
      </span>
    );
  }

  return (
    <div className={cx("mt-6 rounded-[22px] bg-black/25 px-4 py-5 ring-2 sm:px-6", style.ring)} data-no-fx>
      <p className="m-0 flex items-center justify-center gap-2 text-center text-sm font-semibold uppercase tracking-wide text-white/80">
        {/* Under an hour a red dot blinks; the numbers themselves stay steady and readable. */}
        {tone === "urgent" && <span className="size-2.5 animate-pulse rounded-full bg-[#ff6b6b]" aria-hidden />}
        {tone === "over" ? t("handover.countdown.overTitle") : t("handover.countdown.title", { hours: two(totalHours) })}</p>
      <div className="mt-3 flex items-start justify-center gap-2 sm:gap-4" role="timer" aria-label={t("handover.countdown.aria", { h: two(h), m: two(m) })}>
        {units.map((u, i) => (
          <div key={i} className="flex items-start gap-2 sm:gap-4">
            {i > 0 && (
              <span className={cx("lc-d text-[clamp(40px,10vw,76px)] font-semibold leading-none", style.text)} aria-hidden>
                :
              </span>
            )}
            <div className="flex min-w-[2.3ch] flex-col items-center">
              <span className={cx("lc-d text-[clamp(44px,11vw,84px)] font-semibold leading-none tabular-nums tracking-[-0.03em]", style.text)}>{two(u.v)}</span>
              <span className="mt-1.5 text-xs font-medium text-white/70">{u.label}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className={cx("h-full rounded-full transition-[width] duration-1000 ease-linear", style.bar)} style={{ width: `${Math.round(used * 1000) / 10}%` }} />
      </div>
      <p className={cx("m-0 mt-3 text-center text-sm font-semibold", tone === "calm" ? "text-white/85" : style.text)}>
        {tone === "over" ? t("handover.countdown.overLine") : tone === "urgent" ? t("handover.countdown.urgentLine") : tone === "soon" ? t("handover.countdown.soonLine") : t("handover.countdown.calmLine")}
      </p>
    </div>
  );
}
