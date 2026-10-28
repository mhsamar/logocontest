import Link from "@/components/ui/link";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";

const Shield = ({ size }: { size: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </svg>
);

/** One look-alike row of the example report. */
function Match({ art, place, score, color, bar, width }: { art: React.ReactNode; place: string; score: string; color: string; bar: string; width: number }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#EEEFF2] py-2 last:border-b-0">
      {art}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex justify-between gap-1.5 text-[13.5px] font-bold">
          <span className="whitespace-nowrap">{place}</span>
          <span className="whitespace-nowrap" style={{ color }}>
            {score}
          </span>
        </span>
        <span className="h-1.5 rounded-full bg-[#F0F1F4]">
          <span className="block h-full rounded-full" style={{ width: `${width}%`, background: bar }} />
        </span>
      </span>
    </div>
  );
}

/**
 * Home: the AI copyright checker (owner, 2026-10-11; Design/rewards/home-ai-checker-section.html), in place of "Work
 * with designers you can trust". The report card is an example drawing, marked "Example": no real logo is shown.
 * The prices and the number of checks come from Settings.
 */
export async function AiChecker() {
  const { t, locale, price } = await getI18n();
  // Owner, 2026-10-14: free on every logo contest, 15 checks for each ৳1,000 of prize (Settings).
  const s = await getSettings(["limits.logo_checks_per_1000"]);
  const per = s["limits.logo_checks_per_1000"];
  const fmt = (n: number) => formatNumber(n, locale);
  const scores = [
    { n: 14, label: t("home.aiCheck.scores.unique"), color: "#A3121B" },
    { n: 84, label: t("home.aiCheck.scores.legible"), color: "#14633C" },
    { n: 77, label: t("home.aiCheck.scores.colour"), color: "#14633C" },
    { n: 58, label: t("home.aiCheck.scores.overall"), color: "#111216" },
  ];

  return (
    <section id="ai-check" className="relative isolate overflow-hidden rounded-[32px] bg-[linear-gradient(120deg,#4A0808_0%,#8B0000_52%,#5C0A0C_100%)] px-6 py-[52px] text-white">
      <span aria-hidden className="absolute -right-[120px] -top-40 -z-10 size-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(255,226,122,.22),rgba(255,226,122,0))]" />
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-x-14 gap-y-9">
        <div className="lc-rv lc-sl flex min-w-0 flex-[1_1_420px] flex-col items-start gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.14] px-3.5 py-1.5 text-[14px] font-bold">
            <Shield size={16} />
            {t("home.aiCheck.eyebrow")}
          </span>
          <h2 className="m-0 text-[clamp(32px,4.2vw,54px)] font-semibold leading-[1.04] tracking-[-0.04em]">
            {t("home.aiCheck.title")} <span className="whitespace-nowrap text-[#FFE27A]">{t("home.aiCheck.titleAccent")}</span>
          </h2>
          <p className="m-0 max-w-[500px] text-[18px] text-[#F6DAD8]">{t("home.aiCheck.lead")}</p>
          <div className="flex flex-wrap gap-2 text-[15px] font-bold">
            <span className="rounded-full bg-[#FFE27A] px-3.5 py-[7px] text-[#3A2A00]">{t("home.aiCheck.free")}</span>
            <span className="rounded-full border border-white/35 px-3.5 py-[7px]">{t("home.aiCheck.checks", { n: fmt(per) })}</span>
            <span className="rounded-full border border-white/35 px-3.5 py-[7px]">{t("home.aiCheck.price", { amount: price(3000), n: fmt(per * 3) })}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/start" className="inline-flex min-h-[52px] items-center rounded-2xl bg-white px-7 font-bold text-[#8B0000]">
              {t("home.aiCheck.start")}
            </Link>
            <span className="text-[14px] text-[#F0C9C6]">{t("home.aiCheck.note")}</span>
          </div>
        </div>

        {/* The example report (a drawing, not a real check) */}
        <div className="lc-rv lc-sr relative mx-auto min-w-0 max-w-[520px] flex-[1_1_420px] pb-[18px]">
          <div className="lc-sh flex flex-col gap-3.5 rounded-[24px] bg-white px-[18px] pb-10 pt-[18px] text-[#111216]">
            <div className="flex items-center justify-between gap-2.5">
              <span className="inline-flex items-center gap-2 text-[15px] font-bold">
                <span className="flex size-[26px] items-center justify-center rounded-lg bg-[#FBECEB] text-[#8B0000]">
                  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="M16 16l4 4" />
                  </svg>
                </span>
                {t("home.aiCheck.report")}
              </span>
              <span className="rounded-full bg-[#FFF4D1] px-2.5 py-[3px] text-[12.5px] font-bold text-[#6B4E00]">{t("home.aiCheck.example")}</span>
            </div>
            <div className="flex flex-wrap gap-3.5">
              <div className="flex min-w-0 flex-[1_1_150px] flex-col gap-2">
                <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-2xl bg-black text-white">
                  {/* A CL monogram drawn in type, standing in for "your logo" */}
                  <span aria-hidden className="relative block h-[84px] w-[76px] font-[Georgia,'Times_New_Roman',serif]">
                    <span className="absolute left-0 top-0 text-[78px] leading-none">C</span>
                    <span className="absolute left-[30px] top-[14px] text-[70px] leading-none text-[#FFE27A]">L</span>
                  </span>
                  <span aria-hidden className="lc-scan absolute inset-x-0 top-[46%] h-[3px] bg-[linear-gradient(90deg,rgba(255,226,122,0),#FFE27A,rgba(255,226,122,0))] shadow-[0_0_18px_6px_rgba(255,226,122,.35)]" />
                  <span className="absolute left-2 top-2 rounded-full bg-white/[0.16] px-2 py-0.5 text-[11.5px] font-bold">{t("home.aiCheck.yourLogo")}</span>
                </div>
                <div className="flex flex-wrap gap-[5px] text-[12.5px] font-bold text-[#3A3C45]">
                  <span className="rounded-full bg-[#F0F1F4] px-[9px] py-[3px]">{t("home.aiCheck.tags.shape")}</span>
                  <span className="rounded-full bg-[#F0F1F4] px-[9px] py-[3px]">{t("home.aiCheck.tags.reads")}</span>
                  <span className="rounded-full bg-[#F0F1F4] px-[9px] py-[3px]">{t("home.aiCheck.tags.font")}</span>
                </div>
              </div>
              <div className="flex min-w-0 flex-[1.5_1_210px] flex-col">
                <span className="text-[13px] font-bold text-[#5F626B]">{t("home.aiCheck.lookAlikes")}</span>
                <Match
                  art={
                    <span aria-hidden className="relative flex size-[54px] flex-none overflow-hidden rounded-xl border-2 border-[#B3261E] bg-white font-[Georgia,serif] text-[#111216]">
                      <span className="absolute left-[8px] top-[4px] text-[38px] leading-none">C</span>
                      <span className="absolute left-[22px] top-[10px] text-[34px] leading-none text-[#8B0000]">L</span>
                    </span>
                  }
                  place={t("home.aiCheck.web")}
                  score={t("home.aiCheck.similar", { n: fmt(86) })}
                  color="#A3121B"
                  bar="#B3261E"
                  width={86}
                />
                <Match
                  art={
                    <span aria-hidden className="relative flex size-[54px] flex-none overflow-hidden rounded-xl border-2 border-[#D08A1E] bg-[#F4EFE4] font-[Georgia,'Times_New_Roman',serif] text-[#1F3A5F]">
                      <span className="absolute left-[7px] top-[3px] text-[38px] leading-none">C</span>
                      <span className="absolute left-[21px] top-[11px] text-[34px] leading-none">L</span>
                    </span>
                  }
                  place={t("home.aiCheck.web")}
                  score={t("home.aiCheck.similar", { n: fmt(68) })}
                  color="#9A3412"
                  bar="#D08A1E"
                  width={68}
                />
                <Match
                  art={<span aria-hidden className="flex size-[54px] flex-none items-center justify-center rounded-xl bg-[#111216] font-[Georgia,serif] text-[18px] font-medium italic text-white">Lc</span>}
                  place={t("home.aiCheck.site")}
                  score={t("home.aiCheck.notClose", { n: fmt(31) })}
                  color="#14633C"
                  bar="#1F7A4D"
                  width={31}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {scores.map((x) => (
                <div key={x.label} className="flex flex-col items-center gap-1 rounded-xl bg-[#F5F6F8] px-1.5 py-3 text-center">
                  <strong className="lc-d whitespace-nowrap text-[22px] font-semibold leading-none" style={{ color: x.color }}>
                    {fmt(x.n)}
                    <span className="text-[12.5px] font-bold tracking-normal text-[#5F626B]"> /{fmt(100)}</span>
                  </strong>
                  <span className="text-[12.5px] font-bold text-[#5F626B]">{x.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lc-sh absolute -bottom-4 -right-1.5 flex -rotate-3 items-center gap-2.5 rounded-2xl bg-[#FFE27A] py-2.5 pl-2.5 pr-4 text-[#3A2A00]">
            <span className="flex size-[38px] flex-none items-center justify-center rounded-[11px] bg-white text-[#8B0000]">
              <Shield size={20} />
            </span>
            <span className="flex flex-col leading-tight">
              <strong className="text-[15px]">{t("home.aiCheck.certificate")}</strong>
              <span className="text-[13px] font-semibold">{t("home.aiCheck.formats")}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
