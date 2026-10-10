import { getI18n } from "@/lib/i18n/server";
import { LcMark, LogoTile } from "./logo-tile";
import { ButtonLink } from "@/components/ui/button";
import { Arrow, SectionHead } from "@/components/ui/section-heading";

/** One "fine-tune the feel" slider from the wizard, as drawn in step 1. */
function Slider({ left, right, at }: { left: string; right: string; at: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[52px]">{left}</span>
      <div className="relative h-[5px] flex-1 rounded-full bg-[var(--lc-line)]">
        <span className="lc-knob absolute top-[-5px] h-[15px] w-[15px] rounded-full border-[3px] border-white bg-[var(--lc-red)] shadow-[0_1px_4px_rgba(0,0,0,.25)]" style={{ left: `${at}%` }} />
      </div>
      <span className="w-[52px] text-right">{right}</span>
    </div>
  );
}

/** "Your new logo in three steps" (design file). Step 2 and 3 tiles use real winning logos when there are any. */
export async function Steps({ logos }: { logos: string[] }) {
  const { t } = await getI18n();
  const step = (n: 1 | 2 | 3, art: React.ReactNode) => (
    <div className="lc-rv flex flex-col rounded-[28px] bg-[var(--lc-panel-alt)] p-2.5">
      <div className="flex h-[220px] flex-col items-center justify-center gap-3 p-5">{art}</div>
      <div className="flex flex-col gap-2 px-[18px] pb-5 pt-3">
        <span className="text-sm font-bold text-[var(--lc-red)]">{t("home.landing.step", { n })}</span>
        <h3 className="m-0 text-2xl font-semibold leading-[1.15] tracking-[-0.03em]">{t(`home.how.step${n}.title`)}</h3>
        <p className="m-0 text-[var(--lc-muted)]">{t(`home.how.step${n}.body`)}</p>
      </div>
    </div>
  );

  return (
    <section id="how" className="rounded-[32px] bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-11">
        <SectionHead
          icon={
            <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 3L5 13.5h6L10 21l9-11h-6z" />
            </svg>
          }
          lead={t("home.how.titleLead")}
          accent={t("home.how.titleAccent")}
        />
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
          {step(
            1,
            <div className="lc-card lc-sh flex w-full max-w-[280px] flex-col gap-3.5 rounded-[18px] p-[18px] text-sm font-semibold text-[var(--lc-muted)]">
              <Slider left={t("wizard.sliders.complexity.left")} right={t("wizard.sliders.complexity.right")} at={28} />
              <Slider left={t("wizard.sliders.era.left")} right={t("wizard.sliders.era.right")} at={66} />
              <Slider left={t("wizard.sliders.tone.left")} right={t("wizard.sliders.tone.right")} at={46} />
            </div>,
          )}
          {step(
            2,
            <>
              <div className="flex gap-2.5">
                <LogoTile src={logos[0]} fallback={0} className="h-24 w-24 rounded-[22px]" />
                <LogoTile src={logos[1]} fallback={1} className="h-24 w-24 rounded-[22px]" />
              </div>
              <div className="lc-card lc-sh lc-pop rounded-[14px_14px_14px_4px] px-3.5 py-[9px] text-[15px] font-medium">{t("home.how.art.comment")}</div>
            </>,
          )}
          {step(
            3,
            <div className="lc-card lc-sh flex items-center gap-4 rounded-[22px] p-4">
              {logos[2] ? (
                <LogoTile src={logos[2]} fallback={1} className="h-[88px] w-[88px] flex-none rounded-[22px]" />
              ) : (
                <span className="lc-g flex h-[88px] w-[88px] flex-none items-center justify-center rounded-[22px] bg-[image:var(--lc-grad-icon)]">
                  <LcMark width={42} />
                </span>
              )}
              <div className="flex flex-col gap-2">
                <span className="self-start rounded-full bg-[var(--lc-gold)] px-2.5 py-[3px] text-[13px] font-bold text-[var(--lc-gold-ink)]">{t("home.preview.picked")}</span>
                <div className="flex flex-wrap gap-[5px] text-xs font-bold">
                  {["AI", "SVG", "PNG", "PDF"].map((f) => (
                    <span key={f} className="rounded-[7px] bg-[var(--lc-tile)] px-2 py-1">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>,
          )}
        </div>
        <ButtonLink href="/start" size="xl">
          {t("home.cta")}
          <Arrow />
        </ButtonLink>
      </div>
    </section>
  );
}
