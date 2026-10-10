import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { Svg } from "@/components/ui/svg";
import { LogoTile } from "./logo-tile";
import { IconBadge, SectionHead } from "@/components/ui/section-heading";

// Freelancer, design agency, logocontest.bd (same rows as before).
const COMPARE: { key: "many" | "price" | "original" | "copyright" | "held"; values: [boolean, boolean] }[] = [
  { key: "many", values: [false, false] },
  { key: "price", values: [true, false] },
  { key: "original", values: [false, true] },
  { key: "copyright", values: [false, true] },
  { key: "held", values: [false, false] },
];

const ICONS = {
  card: "M3 6h18v13H3zM3 10.5h18M7 15h3",
  pen: "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3",
  copyright: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15 9.5a3.5 3.5 0 1 0 0 5",
  shield: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
};

function Feature({ icon, dark, title, body, className = "" }: { icon: string; dark?: boolean; title: string; body: string; className?: string }) {
  return (
    <div className={`lc-rv flex flex-col gap-7 rounded-[28px] bg-[var(--lc-panel-alt)] p-7 ${className}`}>
      <IconBadge size="lg" dark={dark}>
        <Svg d={icon} size={28} stroke="#FFFFFF" />
      </IconBadge>
      <div className="flex flex-col gap-1.5">
        <h3 className="m-0 text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
        <p className="m-0 text-[var(--lc-muted)]">{body}</p>
      </div>
    </div>
  );
}

/** "More ideas, less risk" (design file): five reasons and the comparison table. */
export async function Why({ logos }: { logos: string[] }) {
  const { t } = await getI18n();
  const cell = (yes: boolean) => (yes ? <span className="font-bold">{t("home.why.compare.yes")}</span> : <span className="text-[var(--lc-faint)]">{t("home.why.compare.no")}</span>);
  return (
    <section className="rounded-[32px] bg-white px-6 py-20">
      <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-11">
        <SectionHead pill={t("home.why.eyebrow")} lead={t("home.why.titleLead")} accent={t("home.why.titleAccent")} />
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
          <Feature icon={ICONS.card} title={t("home.why.bkash.title")} body={t("home.why.bkash.body")} />
          <Feature icon={ICONS.pen} dark title={t("home.why.original.title")} body={t("home.why.original.body")} />
          <Feature icon={ICONS.copyright} title={t("home.why.ownership.title")} body={t("home.why.ownership.body")} />
        </div>
        <div className="-mt-[30px] flex w-full flex-wrap gap-3.5">
          <div className="lc-rv lc-mi flex flex-[2_1_480px] flex-wrap items-center justify-between gap-6 rounded-[28px] bg-[var(--lc-panel-alt)] p-7">
            <div className="flex flex-[1_1_240px] flex-col gap-1.5">
              <h3 className="m-0 text-[28px] font-semibold tracking-[-0.03em]">{t("home.why.ideas.title")}</h3>
              <p className="m-0 text-[var(--lc-muted)]">{t("home.why.ideas.body")}</p>
            </div>
            <div className="flex pl-3.5" aria-hidden>
              {[
                { fb: 10, r: -8 },
                { fb: 3, r: 5 },
                { fb: 0, r: -4 },
                { fb: 5, r: 7 },
              ].map((x, i) => (
                <LogoTile key={i} src={logos[i]} fallback={x.fb} className="-ml-3.5 h-[84px] w-[84px] rounded-[22px]" style={{ transform: `rotate(${x.r}deg)` }} />
              ))}
            </div>
          </div>
          <Feature icon={ICONS.shield} dark title={t("home.why.held.title")} body={t("home.why.held.body")} className="flex-[1_1_300px]" />
        </div>

        <div className="lc-rv flex w-full flex-col gap-4 pt-7">
          <h3 className="m-0 text-center text-[30px] font-semibold tracking-[-0.03em]">{t("home.why.compare.title")}</h3>
          <div className="lc-card overflow-x-auto p-2.5">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[17px]">
              <thead>
                <tr>
                  <th scope="col" className="px-[18px] py-4 text-left text-[15px] font-semibold text-[var(--lc-muted)]">
                    {t("home.landing.compareHead")}
                  </th>
                  <th scope="col" className="p-4 text-[15px] font-semibold text-[var(--lc-muted)]">
                    {t("home.why.compare.freelancer")}
                  </th>
                  <th scope="col" className="p-4 text-[15px] font-semibold text-[var(--lc-muted)]">
                    {t("home.why.compare.agency")}
                  </th>
                  <th scope="col" className="lc-d rounded-t-[18px] bg-[var(--lc-tint)] p-4 text-[17px] font-semibold tracking-[-0.02em] text-[var(--lc-red)]">
                    {t("brand.name")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.key}>
                    <th scope="row" className="border-t border-[var(--lc-line-soft)] px-[18px] py-4 text-left font-semibold">
                      {t(`home.why.compare.rows.${row.key}` as MessageKey)}
                    </th>
                    <td className="border-t border-[var(--lc-line-soft)] p-4 text-center">{cell(row.values[0])}</td>
                    <td className="border-t border-[var(--lc-line-soft)] p-4 text-center">{cell(row.values[1])}</td>
                    <td className={`bg-[var(--lc-tint)] p-4 text-center font-bold text-[var(--lc-red)] ${i === COMPARE.length - 1 ? "rounded-b-[18px]" : ""}`}>{t("home.why.compare.yes")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
