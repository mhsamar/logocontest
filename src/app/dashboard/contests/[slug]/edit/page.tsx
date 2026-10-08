import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditBriefForm } from "@/components/manage/edit-brief-form";
import { EmptyState } from "@/components/ui/empty-state";
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
  if (!contest || !contest.isOwner) notFound();
  const record = await contestRepository().findContest(contest.id);
  if (!record) notFound();
  const back = `/dashboard/contests/${contest.slug}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
      <Link href={back} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        ← {contest.brandName}
      </Link>
      <h1 className="mt-1 text-h1 font-bold tracking-tight text-ink lg:text-4xl">{t("manage.edit.title")}</h1>
      <p className="mt-2 text-muted">{t("manage.edit.subtitle")}</p>
      <div className="mt-6">
        {contest.status === "open" ? (
          <EditBriefForm contestId={contest.id} initial={record.brief} backHref={back} />
        ) : (
          <EmptyState title={t("manage.edit.closed")} />
        )}
      </div>
    </div>
  );
}
