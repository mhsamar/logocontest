import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditBriefForm } from "@/components/manage/edit-brief-form";
import { EmptyState } from "@/components/ui/empty-state";
import { BackLink } from "@/components/ui/back-link";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { adminUser } from "@/lib/admin/core";
import { getCurrentUser } from "@/lib/auth/session";
import { getContestBySlug } from "@/lib/contests/browse";
import { briefFileLimits } from "@/lib/contests/brief-files";
import { contestRepository } from "@/lib/contests/services";
import { getI18n } from "@/lib/i18n/server";
import { getOnboarding } from "@/lib/onboarding/store";
import { createAdminClient } from "@/lib/supabase/admin";

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
  // Staff need Contests › Manage, as the save does.
  const isAdmin = user.role === "admin" && Boolean(await adminUser("contests.manage"));
  if (!contest || !(contest.isOwner || isAdmin)) notFound();
  const record = await contestRepository().findContest(contest.id);
  if (!record) notFound();
  const back = isAdmin && !contest.isOwner ? `/admin/contests/${contest.slug}` : `/dashboard/contests/${contest.slug}`;
  const open = contest.status === "open";
  // Reference photos (owner, 2026-10-22): the ones already on the contest, and the wizard's limits.
  const [files, limits, onboarding] = open
    ? await Promise.all([
        createAdminClient().from("contest_files").select("id, original_name, mime_type, type").eq("contest_id", contest.id).order("created_at"),
        briefFileLimits(),
        getOnboarding("client"),
      ])
    : [null, null, null];

  return (
    <PageShell>
      <BackLink href={back}>{contest.brandName}</BackLink>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle lead={t("manage.edit.title")} sub={t(contest.service === "logo" ? "manage.edit.subtitle" : "manage.edit.photosOnlySub")} />
      </Panel>
      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="mx-auto w-full max-w-3xl">
          {open && limits && onboarding ? (
            <EditBriefForm
              contestId={contest.id}
              initial={record.brief}
              backHref={back}
              hidden={onboarding.hidden}
              files={(files?.data ?? []).map((f) => ({ id: f.id as string, name: f.original_name as string, type: f.mime_type as string, isCurrentLogo: f.type === "current_logo" }))}
              fileLimits={{ maxFiles: limits.maxFiles, maxMb: limits.maxMb }}
              currentLogo={contest.service === "logo"}
              photosOnly={contest.service !== "logo"}
            />
          ) : (
            <EmptyState title={t("manage.edit.closed")} />
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
