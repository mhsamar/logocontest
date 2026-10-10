import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { Svg } from "./hero";
import { Arrow } from "./section-head";

/** The two ways in (design file): run a contest, or join as a designer. */
export async function Join() {
  const { t } = await getI18n();
  const card = "lc-rv flex flex-col items-start gap-4 rounded-[32px] bg-white p-11";
  const title = "mt-2 mb-0 text-[clamp(30px,3.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--lc-red)]";
  const body = "m-0 max-w-[440px] text-lg text-[var(--lc-muted)]";
  return (
    <section id="join" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3.5">
      <div className={card}>
        <span className="lc-g flex h-16 w-16 items-center justify-center rounded-[20px] bg-[image:var(--lc-grad-icon)]">
          <Svg d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8.5 20h7" size={30} stroke="#FFFFFF" />
        </span>
        <h2 className={title}>{t("home.ways.contest.title")}</h2>
        <p className={body}>{t("home.ways.contest.body")}</p>
        <Link href="/start" className="mt-2.5 inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-[image:var(--lc-grad)] px-[26px] font-bold text-white">
          {t("home.ways.contest.cta")}
          <Arrow />
        </Link>
      </div>
      <div className={card}>
        <span className="lc-g flex h-16 w-16 items-center justify-center rounded-[20px] bg-[image:var(--lc-grad-dark)]">
          <Svg d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3" size={30} stroke="#FFFFFF" />
        </span>
        <h2 className={title}>{t("nav.becomeDesigner")}</h2>
        <p className={body}>{t("home.ways.designer.body")}</p>
        <Link href="/designers/signup" className="lc-sh mt-2.5 inline-flex min-h-[52px] items-center gap-2 rounded-2xl border-[1.5px] border-[var(--lc-red)] bg-white px-[26px] font-bold text-[var(--lc-red)]">
          {t("home.ways.designer.cta")}
          <Arrow />
        </Link>
      </div>
    </section>
  );
}
