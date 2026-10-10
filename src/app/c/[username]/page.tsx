import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContestCard } from "@/components/contests/contest-card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { contestsByIds } from "@/lib/contests/browse";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { clientByUsername } from "@/lib/rewards/queries";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/c/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [{ t, locale }, client] = await Promise.all([getI18n(), clientByUsername(username)]);
  if (!client) return { title: t("notFound.title"), robots: { index: false } };
  const title = t("clientProfile.metaTitle", { name: client.businessName ?? client.name });
  const path = `/c/${username.toLowerCase()}`;
  return { title, alternates: { canonical: path }, openGraph: openGraphFor({ title, path, locale }) };
}

// P-12 Client public profile (BLUEPRINT §8.4): total spent, contests, and their non-private contests. No contact details.
export default async function ClientProfilePage({ params }: PageProps<"/c/[username]">) {
  const { username } = await params;
  const [{ t, locale }, client] = await Promise.all([getI18n(), clientByUsername(username)]);
  if (!client) notFound();
  const contests = await contestsByIds(client.publicContestIds);
  const display = client.businessName ?? client.name;
  const now = new Date();
  return (
    <PageShell>
      <Panel as="header">
        <div className="mx-auto max-w-[1160px]">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            <Avatar name={display} url={client.avatarUrl} className="lc-ph size-20 text-2xl" tone="cream" />
            <div className="min-w-0">
              <h1 className="m-0 text-[clamp(30px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.04em] text-ink">{display}</h1>
              <p className="m-0 mt-1.5 text-muted">{t("clientProfile.memberSince", { date: formatDate(client.memberSince, locale, "month") })}</p>
            </div>
          </div>
          <dl className="mx-auto m-0 mt-7 grid max-w-md grid-cols-2 gap-2.5 sm:mx-0">
            <div className="flex flex-col-reverse rounded-[20px] bg-frame px-4 py-3.5 text-center">
              <dt className="text-sm text-muted">{t("clientProfile.spent")}</dt>
              <dd className="lc-d m-0 text-3xl font-semibold tabular-nums tracking-[-0.03em] text-primary">{formatTaka(client.totalSpent, locale)}</dd>
            </div>
            <div className="flex flex-col-reverse rounded-[20px] bg-frame px-4 py-3.5 text-center">
              <dt className="text-sm text-muted">{t("clientProfile.contests")}</dt>
              <dd className="lc-d m-0 text-3xl font-semibold tabular-nums tracking-[-0.03em] text-ink">{formatNumber(client.contestsCount, locale)}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      <Panel tone="grey">
        <div className="mx-auto max-w-[1160px]">
          <h2 className="m-0 text-[clamp(26px,3vw,38px)] font-semibold tracking-[-0.03em]">{t("clientProfile.list")}</h2>
          {contests.length === 0 ? (
            <div className="mt-6 max-w-xl">
              <EmptyState title={t("clientProfile.none")} />
            </div>
          ) : (
            <ul className="m-0 mt-6 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {contests.map((c) => (
                <li key={c.id} className="lc-rv">
                  <ContestCard contest={c} now={now} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
