import Link from "next/link";
import { PageShell } from "@/components/ui/panel";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { sizeText, type Lang, type ServiceDef } from "@/lib/services/types";

/**
 * "What do you need?" (owner, 2026-10-13): the first step of a new contest while more than one service is on in
 * Admin → Services. Each card opens that service's wizard.
 */
export async function ServicePicker({ services }: { services: ServiceDef[] }) {
  const { t, locale } = await getI18n();
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-1 py-4">
        <div className="flex flex-col gap-2">
          <span className="self-start rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-primary">{t("services.picker.kicker")}</span>
          <h1 className="m-0 text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.06] tracking-[-0.04em] text-ink">{t("services.picker.title")}</h1>
          <p className="m-0 max-w-[620px] text-[17px] text-muted">{t("services.picker.lead")}</p>
        </div>
        <ul className="m-0 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/start?service=${s.slug}`}
                className="group flex h-full flex-col gap-2 rounded-[22px] border border-line bg-surface p-5 transition-[transform,box-shadow,border-color] hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_40px_rgba(17,18,22,.08)]"
              >
                <strong className="text-[19px] tracking-[-0.02em] text-ink">{l(s.name)}</strong>
                <span className="text-[15px] text-muted">{l(s.short)}</span>
                <span className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-[13px] font-semibold text-muted">
                  {sizeText(s) && <span className="rounded-full bg-frame px-2.5 py-1">{sizeText(s)}</span>}
                  <span className="rounded-full bg-frame px-2.5 py-1">{t("services.picker.from", { amount: formatTaka(s.minPrize, locale) })}</span>
                </span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-bold text-primary">
                  {t("services.picker.start")}
                  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-1">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
