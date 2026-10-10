import type { Metadata } from "next";
import { PageShell, Panel } from "@/components/ui/panel";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { verifyView } from "@/lib/logo-check/queries";
import { certNumber, parseCertNumber } from "@/lib/logo-check/rules";

export async function generateMetadata({ params }: PageProps<"/verify/[number]">): Promise<Metadata> {
  const { t } = await getI18n();
  const n = parseCertNumber((await params).number);
  return { title: t("verify.title", { no: n ? certNumber(n) : "" }), robots: { index: false, follow: false } };
}

const TONE = { no_match: "bg-[#e3f3ea] text-[#14633c]", similar: "bg-[#ffedd5] text-[#9a3412]", high_risk: "bg-[#fde3e1] text-[#a3121b]" } as const;

/**
 * Verify a Logo Research Certificate (owner, 2026-10-10): anyone with the link or the QR code sees whether the
 * number is real, the date, the checked logo and the result. Nothing else, no contact details.
 */
export default async function VerifyPage({ params }: PageProps<"/verify/[number]">) {
  const { t, locale } = await getI18n();
  const n = parseCertNumber((await params).number);
  const cert = n ? await verifyView(n) : null;

  return (
    <PageShell>
      <Panel className="flex flex-1 flex-col items-center py-14 text-center">
        <p className="m-0 text-[13px] font-bold uppercase tracking-[0.16em] text-muted">{t("verify.kicker")}</p>
        {cert ? (
          <>
            <span className="mt-5 flex size-14 items-center justify-center rounded-full bg-[#e3f3ea] text-[#14633c]" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h1 className="m-0 mt-4 text-[clamp(26px,3.4vw,40px)] font-semibold tracking-[-0.035em] text-ink">{t("verify.real", { no: certNumber(cert.number) })}</h1>
            <p className="m-0 mt-2 text-lg text-muted">{t("verify.made", { date: formatDate(new Date(cert.finishedAt), locale, "long") })}</p>
            <div className="mt-8 flex w-full max-w-md flex-col items-center gap-4 rounded-[24px] bg-frame p-6">
              {cert.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cert.logoUrl} alt={t("verify.logo")} className="size-44 rounded-[16px] bg-white object-contain p-3 ring-1 ring-line" />
              )}
              <span className={cx("rounded-full px-3.5 py-1 text-[15px] font-bold", TONE[cert.verdict])}>{t(`verify.verdicts.${cert.verdict}`)}</span>
              {cert.closest > 0 && <p className="m-0 text-[15px] text-muted">{t("verify.closest", { n: String(cert.closest) })}</p>}
            </div>
            <p className="m-0 mt-8 max-w-lg text-sm leading-relaxed text-muted">{t("verify.note")}</p>
          </>
        ) : (
          <>
            <h1 className="m-0 mt-4 text-[clamp(26px,3.4vw,40px)] font-semibold tracking-[-0.035em] text-ink">{t("verify.notFound")}</h1>
            <p className="m-0 mt-2 max-w-md text-lg text-muted">{t("verify.notFoundBody")}</p>
          </>
        )}
      </Panel>
    </PageShell>
  );
}
