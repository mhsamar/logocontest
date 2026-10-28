import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { GuideCard } from "@/components/guides/guide-card";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { cx } from "@/lib/cx";
import { publishedGuides } from "@/lib/guides/queries";
import { isGuideCategory } from "@/lib/guides/rules";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [{ t, locale }, guides] = await Promise.all([getI18n(), publishedGuides()]);
  const title = t("guides.meta.title");
  const description = t("guides.meta.description");
  return {
    title,
    description,
    alternates: await pageAlternates("/guides"),
    openGraph: openGraphFor({ title, description, path: "/guides", locale }),
    // An empty list is a thin page: kept out of search until the first guide is published.
    ...(guides.length ? {} : { robots: { index: false, follow: true } }),
  };
}

// Guides (owner, 2026-10-15): articles for clients and designers, written in Admin › Guides.
export default async function GuidesPage({ searchParams }: PageProps<"/guides">) {
  const sp = await searchParams;
  const [{ t, locale }, all] = await Promise.all([getI18n(), publishedGuides()]);
  const filter = typeof sp.for === "string" && isGuideCategory(sp.for) && sp.for !== "everyone" ? sp.for : null;
  // "For everyone" guides are shown in both groups.
  const guides = filter ? all.filter((g) => g.category === filter || g.category === "everyone") : all;
  const tabs = [
    { key: null, label: t("guides.filter.all") },
    { key: "clients", label: t("guides.filter.clients") },
    { key: "designers", label: t("guides.filter.designers") },
  ] as const;

  return (
    <PageShell>
      <Panel as="header">
        <PageTitle center pill={t("guides.pill")} lead={t("guides.title")} sub={t("guides.lead")} />
        {all.length > 0 && (
          <nav aria-label={t("guides.filter.label")} className="mt-7 flex flex-wrap justify-center gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.key ? `/guides?for=${tab.key}` : "/guides"}
                aria-current={filter === tab.key ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full border px-5 text-[15px] font-bold transition-colors",
                  filter === tab.key ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-primary hover:text-primary",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
      </Panel>

      <Panel tone="grey">
        {guides.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-10 text-center">
            <p className="m-0 text-lg text-muted">{t("guides.empty")}</p>
            <ButtonLink href="/how-it-works" variant="secondary">
              {t("guides.emptyCta")}
            </ButtonLink>
          </div>
        ) : (
          <ul className="mx-auto m-0 grid max-w-[1160px] list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((g) => (
              <GuideCard key={g.id} g={g} locale={locale} t={t} />
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  );
}
