import { visibleList } from "@/lib/content/lists";
import { getI18n } from "@/lib/i18n/server";
import { fillLegal } from "@/lib/legal/types";
import { SectionHead } from "./section-head";

const PLUS = "M12 5v14M5 12h14";

/**
 * Q&A (design file), from Lists → Home Q&A (A-15) with prices and days from Settings. One answer open at a
 * time (the first one to start with), with no JavaScript: <details name> keeps them exclusive.
 */
export async function LandingFaq({ params }: { params: Record<string, string | number> }) {
  const { t, locale } = await getI18n();
  const items = await visibleList("home_faq", locale);
  return (
    <section id="faq" className="rounded-[32px] bg-[var(--lc-panel-alt)] px-6 py-20">
      <div className="mx-auto flex max-w-[780px] flex-col items-center gap-10">
        <SectionHead pill={t("home.faq.eyebrow")} lead={t("home.faq.titleLead")} accent={t("home.faq.titleAccent")} />
        <div className="lc-rv flex w-full flex-col gap-2">
          {items.map((item, i) => (
            <details key={item.id} name="lc-faq" open={i === 0} className="lc-card lc-faq group rounded-[20px] px-[22px] [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-[62px] cursor-pointer list-none items-center justify-between gap-4 text-left text-[19px] font-bold text-[var(--lc-ink)]">
                {item.text.q}
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lc-red)" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 transition-transform duration-200 group-open:rotate-45">
                  <path d={PLUS} />
                </svg>
              </summary>
              <p className="m-0 pb-5 text-[var(--lc-muted)]">{fillLegal(item.text.a, params)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
