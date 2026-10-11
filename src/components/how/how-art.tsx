/* eslint-disable @next/next/no-img-element */
import type { Translate } from "@/lib/i18n/translate";

/**
 * The small pictures on the How it works step cards (owner, 2026-10-11; Design/how-it-works). Drawn in HTML; the
 * logos are the site's own sample artwork (public/examples/browse), never the stock logos from the design files.
 */

const Logo = ({ n, className = "" }: { n: number; className?: string }) => (
  <span className={`relative min-h-0 min-w-0 overflow-hidden rounded-xl bg-[#111216] ${className}`}>
    <img src={`/examples/browse/logo-${n}.jpg`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
  </span>
);

const Tick = () => (
  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FRAME = "relative flex h-[226px] flex-col gap-2.5 overflow-hidden rounded-[18px] p-4";

/** Client step 1: the brief form. */
export function BriefArt({ t }: { t: Translate }) {
  const bars: [string, number][] = [
    [t("wizard.sliders.era.right"), 32],
    [t("wizard.sliders.tone.left"), 70],
    [t("wizard.sliders.complexity.left"), 52],
  ];
  return (
    <div aria-hidden className={`${FRAME} bg-[#F4F5F7]`}>
      <div className="flex flex-col gap-[9px] rounded-[14px] bg-white p-3.5 shadow-[0_8px_22px_rgba(17,18,22,.08)]">
        <div className="flex items-center justify-between">
          <strong className="text-sm">{t("howPage.art.brief")}</strong>
          <span className="rounded-full bg-[#FBECEB] px-[9px] py-0.5 text-xs font-bold text-primary">{t("howPage.art.briefStep")}</span>
        </div>
        <span className="flex h-[30px] items-center rounded-lg border border-[#E3E4E8] px-2.5 text-[13px] text-muted">{t("howPage.art.businessName")}</span>
        {bars.map(([label, at]) => (
          <div key={label} className="flex items-center gap-2 text-[12.5px] font-bold text-muted">
            <span className="w-16 truncate">{label}</span>
            <span className="relative h-[5px] flex-1 rounded-full bg-[#E3E4E8]">
              <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${at}%` }} />
              <span className="absolute -top-[4.5px] -ml-[7px] size-3.5 rounded-full border-[3px] border-primary bg-white" style={{ left: `${at}%` }} />
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[12.5px] font-bold text-muted">{t("howPage.art.colours")}</span>
          {["#8B0000", "#D08A1E", "#111216"].map((c) => (
            <span key={c} className="size-[18px] rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Client step 2: many designs and a comment. */
export function DesignsArt({ t }: { t: Translate }) {
  return (
    <div aria-hidden className={`${FRAME} bg-[#F4F5F7]`}>
      <div className="grid flex-1 grid-cols-4 grid-rows-2 gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Logo key={n} n={n} />
        ))}
        <span className="flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#B9BCC4] text-[12.5px] font-bold text-muted">
          <strong className="lc-d text-[17px] text-ink">{t("howPage.art.more")}</strong>
          {t("howPage.art.moreDesigns")}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-[10px] bg-white px-2.5 py-2 text-[13px] text-[#3A3C45]">
        <span className="rounded-full bg-primary px-2 py-px text-[11.5px] font-bold text-white">{t("howPage.art.you")}</span>
        <span className="truncate">{t("home.how.art.comment")}</span>
      </div>
    </div>
  );
}

/** Client step 3: the winner and its files. */
export function FilesArt({ t }: { t: Translate }) {
  return (
    <div aria-hidden className={`${FRAME} flex-row items-stretch bg-[#F4F5F7]`}>
      <span className="relative flex flex-[1.3] overflow-hidden rounded-[14px] border-[3px] border-[#D08A1E] bg-[#111216]">
        <img src="/examples/browse/logo-8.jpg" alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full bg-[#FFE27A] px-[9px] py-0.5 text-xs font-bold text-[#111216]">{t("home.how.art.winner")}</span>
      </span>
      <div className="flex flex-1 flex-col justify-center gap-[7px]">
        <span className="text-[12.5px] font-bold text-muted">{t("howPage.art.yourFiles")}</span>
        {["logo.ai", "logo.svg", "logo.png"].map((f) => (
          <span key={f} className="flex h-8 items-center justify-between rounded-[9px] bg-white px-2.5 font-mono text-[12.5px] font-semibold">
            {f}
            <span className="text-[#14633C]">
              <Tick />
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#14633C]">
          <Tick />
          {t("howPage.art.copyright")}
        </span>
      </div>
    </div>
  );
}

/** Designer step 1: the designer's account. */
export function AccountArt({ t }: { t: Translate }) {
  return (
    <div aria-hidden className={`${FRAME} justify-center bg-[#F4F5F7]`}>
      <div className="flex items-center gap-3 rounded-[14px] bg-white p-3.5 shadow-[0_8px_22px_rgba(17,18,22,.08)]">
        <span className="lc-d flex size-12 flex-none items-center justify-center rounded-full bg-[#FBECEB] text-lg font-semibold text-primary">R</span>
        <div className="flex min-w-0 flex-col leading-tight">
          <strong className="text-[15px]">{t("howPage.art.username")}</strong>
          <span className="text-[12.5px] text-muted">{t("howPage.art.profile")}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[9, 10, 11].map((n) => (
          <Logo key={n} n={n} className="h-[58px]" />
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 text-[13px] font-bold">
        <span>{t("howPage.art.payout")}</span>
        <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[12px] text-[#14633C]">{t("designerSignup.payout.bkash")}</span>
      </div>
    </div>
  );
}

/** Designer step 2: uploading designs. */
export function UploadArt({ t, fmt }: { t: Translate; fmt: (n: number) => string }) {
  return (
    <div aria-hidden className={`${FRAME} bg-[#F4F5F7]`}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#B9BCC4] bg-white text-[13.5px] font-bold text-muted">
        <svg viewBox="0 0 24 24" className="size-7 text-primary" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 16V4M7 9l5-5 5 5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("howPage.art.upload")}
      </div>
      <div className="flex gap-2">
        <Logo n={5} className="h-[54px] flex-1" />
        <Logo n={6} className="h-[54px] flex-1" />
        <span className="flex flex-1 items-center justify-center rounded-xl bg-[#E3F3EA] text-[12.5px] font-bold text-[#14633C]">{t("howPage.art.sent", { n: fmt(2) })}</span>
      </div>
    </div>
  );
}

/** Designer step 3: the win. */
export function WinArt({ t }: { t: Translate }) {
  return (
    <div aria-hidden className={`${FRAME} items-center justify-center gap-1.5 bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] text-center text-white`}>
      <span className="rounded-full bg-[#FFE27A] px-3 py-[3px] text-[12.5px] font-bold text-[#111216]">{t("home.how.art.winner")}</span>
      <strong className="lc-d text-[26px] tracking-[-0.03em]">{t("howPage.art.congrats")}</strong>
      <span className="text-sm text-[#F6DAD8]">{t("howPage.art.prizeSent")}</span>
      <span className="mt-1.5 rounded-xl bg-white/[0.14] px-4 py-2 text-sm font-bold">{t("howPage.art.giftBox")}</span>
    </div>
  );
}
