import { getI18n } from "@/lib/i18n/server";
import { Svg } from "@/components/ui/svg";
import { ButtonLink } from "@/components/ui/button";
import { Arrow, IconBadge } from "@/components/ui/section-heading";

/** The two ways in (design file): run a contest, or join as a designer. */
export async function Join() {
  const { t } = await getI18n();
  const card = "lc-rv flex flex-col items-start gap-4 rounded-[32px] bg-white p-11";
  const title = "mt-2 mb-0 text-[clamp(30px,3.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--lc-red)]";
  const body = "m-0 max-w-[440px] text-lg text-[var(--lc-muted)]";
  return (
    <section id="join" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3.5">
      <div className={card}>
        <IconBadge size="xl">
          <Svg d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8.5 20h7" size={30} stroke="#FFFFFF" />
        </IconBadge>
        <h2 className={title}>{t("home.ways.contest.title")}</h2>
        <p className={body}>{t("home.ways.contest.body")}</p>
        <ButtonLink href="/start" size="lg" className="mt-2.5">
          {t("home.ways.contest.cta")}
          <Arrow />
        </ButtonLink>
      </div>
      <div className={card}>
        <IconBadge size="xl" dark>
          <Svg d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3" size={30} stroke="#FFFFFF" />
        </IconBadge>
        <h2 className={title}>{t("nav.becomeDesigner")}</h2>
        <p className={body}>{t("home.ways.designer.body")}</p>
        <ButtonLink href="/designers/signup" variant="outline" size="lg" className="mt-2.5">
          {t("home.ways.designer.cta")}
          <Arrow />
        </ButtonLink>
      </div>
    </section>
  );
}
