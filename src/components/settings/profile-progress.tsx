import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { profilePercent, STEP_ANCHOR, type ProfileStep } from "@/lib/profile/completeness";

/**
 * "Complete your profile" (owner, 2026-10-13): what a designer still has to add after the four sign-up steps, as a
 * progress bar and one link per missing part. Shown on the dashboard and on top of Profile settings; gone at 100%.
 */
export async function ProfileProgress({ steps, onSettings = false }: { steps: { key: ProfileStep; done: boolean }[]; onSettings?: boolean }) {
  const pct = profilePercent(steps);
  if (pct >= 100) return null;
  const { t, locale } = await getI18n();
  const missing = steps.filter((s) => !s.done);
  const href = (k: ProfileStep) => `${onSettings ? "" : "/dashboard/profile"}#${STEP_ANCHOR[k]}`;
  return (
    <section aria-labelledby="pp-title" className="lc-card flex flex-col gap-3.5 rounded-[22px] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="pp-title" className="m-0 text-lg font-semibold tracking-[-0.02em] text-ink">
            {t("profileProgress.title")}
          </h2>
          <p className="m-0 text-[14.5px] text-muted">{t("profileProgress.lead")}</p>
        </div>
        {!onSettings && <ButtonLink href="/dashboard/profile">{t("profileProgress.cta")}</ButtonLink>}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F0F1F4]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t("profileProgress.title")}>
          <span className="block h-full rounded-full bg-[linear-gradient(90deg,#8B0000,#E2B13C)]" style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap text-[14px] font-bold text-ink">{t("profileProgress.done", { n: formatNumber(pct, locale) })}</span>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {missing.map((s) => (
          <li key={s.key}>
            <Link href={href(s.key)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-tint px-3.5 text-[14px] font-bold text-primary hover:bg-[#F6D9D6]">
              <span aria-hidden>+</span>
              {t(`profileProgress.steps.${s.key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
