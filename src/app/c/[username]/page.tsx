import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContestCard } from "@/components/contests/contest-card";
import { Avatar } from "@/components/ui/avatar";
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
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-6 sm:pt-10">
      <section className="relative animate-rise overflow-clip rounded-[2rem] bg-aurora px-5 py-8 shadow-frame ring-1 ring-white sm:px-8 sm:py-10">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Avatar name={display} url={client.avatarUrl} className="size-20 text-2xl shadow-raised ring-4 ring-white" tone="cream" />
          <div className="min-w-0">
            <h1 className="text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{display}</h1>
            <p className="mt-1 text-sm text-muted">{t("clientProfile.memberSince", { date: formatDate(client.memberSince, locale, "month") })}</p>
          </div>
        </div>
        <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 sm:mx-0">
          <div className="flex flex-col-reverse rounded-2xl bg-white/80 px-4 py-3 text-center ring-1 ring-white">
            <dt className="text-xs text-muted">{t("clientProfile.spent")}</dt>
            <dd className="text-2xl font-extrabold tabular-nums text-accent">{formatTaka(client.totalSpent, locale)}</dd>
          </div>
          <div className="flex flex-col-reverse rounded-2xl bg-white/80 px-4 py-3 text-center ring-1 ring-white">
            <dt className="text-xs text-muted">{t("clientProfile.contests")}</dt>
            <dd className="text-2xl font-extrabold tabular-nums text-ink">{formatNumber(client.contestsCount, locale)}</dd>
          </div>
        </dl>
      </section>

      <h2 className="mt-10 text-h3 font-bold text-ink lg:text-h3-lg">{t("clientProfile.list")}</h2>
      {contests.length === 0 ? (
        <p className="mt-4 rounded-3xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("clientProfile.none")}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contests.map((c) => (
            <li key={c.id} className="reveal">
              <ContestCard contest={c} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
