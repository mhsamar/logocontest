import Link from "next/link";
import { ContestCard } from "@/components/contests/contest-card";
import { liveContests } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { getSettings } from "@/lib/settings";

const TIP_ICONS = [
  <path key="1" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />,
  <path key="2" d="M4 5h16v11H4ZM8 21h8M12 16v5" />,
  <path key="3" d="M12 3v18M3 12h18M7 7l10 10M17 7 7 17" />,
  <path key="4" d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />,
  <path key="5" d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z" />,
  <path key="6" d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
];

const TIP_TINT = [
  "from-[#e8f1ff] to-[#d4e4ff] text-[#1d4ed8]",
  "from-[#fff7e0] to-[#ffe6a8] text-[#8a5105]",
  "from-[#eef2f7] to-[#dde3ec] text-ink",
  "from-[#fff4d1] to-[#ffdf8a] text-[#8a5105]",
  "from-[#e7f8f0] to-[#c9efdc] text-[#0f6b45]",
  "from-[#fff0f3] to-[#ffdce4] text-primary",
];

/** P-01d Designer home (owner, 2026-10-08): open contests, tips, how to upload, rules and fees. */
export async function DesignerHome({ user }: { user: { name: string } }) {
  const { t, locale } = await getI18n();
  const [open, s] = await Promise.all([
    liveContests(3),
    getSettings([
      "limits.entry_min_images",
      "limits.entry_max_images",
      "limits.entry_image_max_mb",
      "limits.entry_image_min_px",
      "limits.max_entries_per_designer",
      "timers.designer_file_upload_days",
      "limits.strikes_for_suspension",
      "limits.strikes_for_ban",
      "fees.designer_tiers",
      "limits.withdrawal_min",
    ]),
  ]);
  const fmt = (n: number) => formatNumber(n, locale);
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const now = new Date();
  const perContest = s["limits.max_entries_per_designer"];
  const tiers = [...s["fees.designer_tiers"]].sort((a, b) => a.min_wins - b.min_wins);

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <section className="relative animate-rise overflow-clip rounded-[2rem] bg-aurora p-6 shadow-frame ring-1 ring-white sm:p-10">
        <span className="pointer-events-none absolute -left-10 -top-12 size-56 animate-float-soft rounded-full bg-[#c9e3ff]/60 blur-2xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-20 right-1/4 size-64 animate-float rounded-full bg-[#ffe2a0]/50 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="text-sm font-semibold text-primary">{t("designerHome.hi", { name: firstName })}</p>
          <h1 className="mt-2 text-h1 font-bold tracking-tight text-ink lg:text-5xl">{t("designerHome.title")}</h1>
          <p className="mt-3 text-lg text-muted">{t("designerHome.lead")}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/contests"
              className="btn-sheen relative inline-flex min-h-12 items-center justify-center gap-2 overflow-clip rounded-full bg-primary px-6 font-semibold text-white shadow-raised transition-[background-color,translate] duration-200 hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.97]"
            >
              {t("designerHome.browse")} →
            </Link>
            <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/85 px-6 font-semibold text-ink ring-1 ring-line transition-colors hover:bg-white">
              {t("designerHome.dashboard")}
            </Link>
          </div>
        </div>
      </section>

      {/* Open now */}
      <section className="mt-14">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-h2 font-bold text-ink lg:text-h2-lg">{t("designerHome.openNow")}</h2>
          <Link href="/contests" className="text-sm font-semibold text-primary hover:underline">
            {t("designerHome.seeAll")} →
          </Link>
        </div>
        {open.length > 0 ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((c) => (
              <li key={c.id} className="reveal">
                <ContestCard contest={c} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("designerHome.none")}</p>
        )}
      </section>

      {/* Tips */}
      <section className="mt-14">
        <h2 className="text-h2 font-bold text-ink lg:text-h2-lg">{t("designerHome.tips.title")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(["t1", "t2", "t3", "t4", "t5", "t6"] as const).map((k, i) => (
            <li key={k} className="reveal">
              <div className="group h-full rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-raised">
                <span className={cx("flex size-11 items-center justify-center rounded-xl bg-gradient-to-br transition-[rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110", TIP_TINT[i])}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {TIP_ICONS[i]}
                  </svg>
                </span>
                <h3 className="mt-3 font-bold text-ink">{t(`designerHome.tips.${k}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {t(`designerHome.tips.${k}.body`, {
                    max: fmt(s["limits.entry_max_images"]),
                    limit: perContest > 0 ? t("designerHome.tips.limited", { n: fmt(perContest) }) : t("designerHome.tips.unlimited"),
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 grid gap-4 lg:grid-cols-2">
        {/* How to upload */}
        <div className="reveal rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line">
          <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("designerHome.upload.title")}</h2>
          <ol className="mt-5 space-y-4">
            {(["s1", "s2", "s3", "s4", "s5"] as const).map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-card">{fmt(i + 1)}</span>
                <p className="pt-1 text-ink">
                  {t(`designerHome.upload.${k}`, {
                    min: fmt(s["limits.entry_min_images"]),
                    max: fmt(s["limits.entry_max_images"]),
                    mb: fmt(s["limits.entry_image_max_mb"]),
                    px: fmt(s["limits.entry_image_min_px"]),
                  })}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Rules */}
        <div className="reveal rounded-3xl bg-gradient-to-br from-[#fff9ef] to-[#fff1d6] p-6 shadow-card ring-1 ring-[#f1c75c]/50">
          <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("designerHome.rules.title")}</h2>
          <ul className="mt-5 space-y-3">
            {(["r1", "r2", "r3", "r4", "r5"] as const).map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#8a5105] text-white" aria-hidden>
                  <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="text-ink">
                  {t(`designerHome.rules.${k}`, {
                    days: fmt(s["timers.designer_file_upload_days"]),
                    suspend: fmt(s["limits.strikes_for_suspension"]),
                    ban: fmt(s["limits.strikes_for_ban"]),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Fees */}
      <section className="reveal mt-14 rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line sm:p-8">
        <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("designerHome.fees.title")}</h2>
        <p className="mt-2 max-w-2xl text-muted">{t("designerHome.fees.body", { min: formatTaka(s["limits.withdrawal_min"], locale) })}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {tiers.map((tier) => (
            <li key={tier.min_wins} className="rounded-2xl bg-canvas p-4 ring-1 ring-line">
              <p className="text-2xl font-extrabold tabular-nums text-[#7a4300]">{t("designerHome.fees.tier", { rate: fmt(tier.rate_percent) })}</p>
              <p className="mt-0.5 text-sm text-muted">{tier.min_wins === 0 ? t("designerHome.fees.first") : t("designerHome.fees.from", { n: fmt(tier.min_wins + 1) })}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
