import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
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
    cx("inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors", active ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-primary");
  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-6 sm:pt-10">
      <header className="animate-rise text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("winners.eyebrow")}</p>
        <h1 className="mt-2 text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("winners.title")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted">{t("winners.lead")}</p>
      </header>

      <nav aria-label={t("winners.filter")} className="-mx-4 mt-6 overflow-x-auto px-4">
        <ul className="flex gap-2 sm:flex-wrap sm:justify-center">
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
        <div className="mx-auto mt-10 max-w-md rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="font-semibold text-ink">{t(type ? "winners.emptyType" : "winners.empty")}</p>
          <p className="mt-1 text-sm text-muted">{t("winners.emptyBody")}</p>
          <div className="mt-5">
            <ButtonLink href="/start">{t("home.cta")}</ButtonLink>
          </div>
        </div>
      ) : (
        <ul className="mt-8 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>li]:mb-4">
          {logos.map((d, i) => (
            <li key={d.entryId} className="reveal break-inside-avoid" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <DesignTile d={d} t={t} canLike={canLike(user, d.designerId)} tall={i % 3 === 1} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
