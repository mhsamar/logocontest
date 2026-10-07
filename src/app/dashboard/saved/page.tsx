import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContestRow } from "@/components/contests/contest-row";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { contestsByIds } from "@/lib/contests/browse";
import { savedContestIdList } from "@/lib/contests/community";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("saved.meta.title"), robots: { index: false } };
}

// D-02 "Saved contests" (BLUEPRINT §10). Lives here until the full designer dashboard is built.
export default async function SavedContestsPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?next=/dashboard/saved");
  if (!can(user, "contest.save")) notFound();

  const contests = await contestsByIds(await savedContestIdList(user.id, 200));
  const now = new Date();

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-6">
      <h1 className="text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("saved.title")}</h1>
      <p className="mt-2 text-muted">{t("saved.subtitle")}</p>
      {contests.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {contests.map((c) => (
            <li key={c.id}>
              <ContestRow contest={c} now={now} saved />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mx-auto mt-10 max-w-xl">
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" strokeLinejoin="round" />
              </svg>
            }
            title={t("saved.emptyTitle")}
            body={t("saved.emptyBody")}
            action={<ButtonLink href="/contests">{t("saved.browse")}</ButtonLink>}
          />
        </div>
      )}
    </div>
  );
}
