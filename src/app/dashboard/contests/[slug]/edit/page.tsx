import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditBriefForm } from "@/components/manage/edit-brief-form";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink } from "@/components/ui/back-link";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug } from "@/lib/contests/browse";
import { contestRepository } from "@/lib/contests/services";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("manage.edit.title"), robots: { index: false } };
}

// C-13b Edit details (owner, 2026-10-08)
export default async function EditContestPage({ params }: PageProps<"/dashboard/contests/[slug]/edit">) {
  const { slug } = await params;
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent(`/dashboard/contests/${slug}/edit`)}`);
  const contest = await getContestBySlug(slug, user);
  const isAdmin = user.role === "admin";
  if (!contest || !(contest.isOwner || isAdmin)) notFound();
  const record = await contestRepository().findContest(contest.id);
  if (!record) notFound();
  const back = isAdmin && !contest.isOwner ? `/admin/contests/${contest.slug}` : `/dashboard/contests/${contest.slug}`;

  return (
    <PageShell>
      <BackLink href={back}>{contest.brandName}</BackLink>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle lead={t("manage.edit.title")} sub={t("manage.edit.subtitle")} />
      </Panel>
      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="mx-auto w-full max-w-3xl">
          {contest.status === "open" ? (
            <EditBriefForm contestId={contest.id} initial={record.brief} backHref={back} />
          ) : (
            <EmptyState title={t("manage.edit.closed")} />
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
