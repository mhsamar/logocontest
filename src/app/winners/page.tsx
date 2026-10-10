import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { BUSINESS_TYPES } from "@/lib/contests/brief";
import { visibleBusinessTypes } from "@/lib/content/lists";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { DesignTile } from "@/components/rewards/design-tile";
import { getCurrentUser } from "@/lib/auth/session";
import { winningDesigns } from "@/lib/rewards/queries";
import { canLike } from "@/lib/rewards/rules";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const title = t("winners.metaTitle");
  return { title, description: t("winners.metaDescription"), alternates: { canonical: "/winners" }, openGraph: openGraphFor({ title, description: t("winners.metaDescription"), path: "/winners", locale }) };
}

// P-05 Winners gallery (UI-JOURNEY): winning logos in a masonry grid, with business-type chips.
export default async function WinnersPage({ searchParams }: PageProps<"/winners">) {
  const sp = await searchParams;
  const type = typeof sp.type === "string" && (BUSINESS_TYPES as readonly string[]).includes(sp.type) ? sp.type : null;
  const [{ t }, user, types] = await Promise.all([getI18n(), getCurrentUser(), visibleBusinessTypes(type)]);
  const logos = await winningDesigns({ type, viewerId: user?.id ?? null, order: "newest", limit: 60 });
  const chip = (active: boolean) =>
    cx("inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-[14px] px-4 text-[15px] font-semibold transition-colors", active ? "bg-ink text-white" : "bg-chip text-ink hover:bg-line");
  return (
    <PageShell>
      <Panel as="header">
        <PageTitle center pill={t("winners.eyebrow")} lead={t("winners.title")} sub={t("winners.lead")} />
      </Panel>

      <Panel tone="grey">
      <nav aria-label={t("winners.filter")} className="-mx-4 overflow-x-auto px-4">
        <ul className="m-0 flex list-none gap-2 p-0 sm:flex-wrap sm:justify-center">
          <li>
            <Link href="/winners" className={chip(!type)} aria-current={!type ? "page" : undefined}>
              {t("winners.all")}
            </Link>
          </li>
          {types.map((b) => (
            <li key={b}>
              <Link href={`/winners?type=${b}`} className={chip(type === b)} aria-current={type === b ? "page" : undefined}>
                {t(`wizard.businessTypes.${b}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {logos.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md">
          <EmptyState title={t(type ? "winners.emptyType" : "winners.empty")} body={t("winners.emptyBody")} action={<ButtonLink href="/start">{t("home.cta")}</ButtonLink>} />
        </div>
      ) : (
        <ul className="m-0 mt-8 list-none columns-2 gap-3.5 p-0 sm:columns-3 lg:columns-4 [&>li]:mb-3.5">
          {logos.map((d, i) => (
            <li key={d.entryId} className="lc-rv break-inside-avoid">
              <DesignTile d={d} t={t} canLike={canLike(user, d.designerId)} tall={i % 3 === 1} />
            </li>
          ))}
        </ul>
      )}
      </Panel>
    </PageShell>
  );
}
