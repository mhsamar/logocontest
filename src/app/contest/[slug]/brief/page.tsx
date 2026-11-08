import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import "@/components/brief-v3/brief-v3.css";
import { MyBrief } from "@/components/brief-v3/my-brief";
import { getCurrentUser } from "@/lib/auth/session";
import { briefConfig, briefPhotos, briefV3On, categoryOptions, editorStart, listBriefUpdates } from "@/lib/brief-v3/store";
import { contestRepository } from "@/lib/contests/services";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { briefOpen } from "@/lib/onboarding/brief-defaults";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("briefV3.mine.title"), robots: { index: false } };
}

/**
 * "Your brief" after paying (owner, 2026-11-08; Design/logocontest-onboarding MyBrief): only the contest's own client,
 * only for a logo contest of the new wizard, only while Admin › Brief has the new brief on. Its edit and update work
 * while the contest can change; later the page is read-only.
 */
export default async function MyBriefPage({ params }: PageProps<"/contest/[slug]/brief">) {
  const { slug } = await params;
  if (!(await briefV3On()) || !isSupabaseConfigured() || !/^[a-z0-9-]{1,120}$/.test(slug)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent(`/contest/${slug}/brief`)}`);
  const { data: row } = await createAdminClient().from("contests").select("id, client_id").eq("slug", slug).maybeSingle();
  if (!row || row.client_id !== user.id) notFound();
  const contest = await contestRepository().findContest(row.id as string);
  if (!contest || contest.service !== "logo") notFound();
  // An older-wizard contest keeps its own "Edit details".
  if (!contest.briefCompletion) redirect(`/client/contests/${contest.slug}`);

  const { t, locale } = await getI18n();
  const [{ categories }, s, updates, photos, initial] = await Promise.all([
    briefConfig(),
    getSettings(["limits.brief_max_files", "limits.brief_file_max_mb"]),
    listBriefUpdates(contest.id),
    briefPhotos(contest.id),
    editorStart(contest.id, contest.brief.brandName, { ...contest.brief, description: contest.brief.businessDescription }, t),
  ]);
  return (
    <div className="b3-page flex w-full flex-1 justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-[480px]">
        <MyBrief
          contestId={contest.id}
          slug={contest.slug}
          status={contest.status}
          editable={briefOpen(contest.status)}
          initial={initial}
          categories={categoryOptions(categories, locale)}
          photos={photos}
          photoLimits={{ maxFiles: s["limits.brief_max_files"], maxMb: s["limits.brief_file_max_mb"] }}
          updates={updates}
          backHref={`/client/contests/${contest.slug}`}
        />
      </div>
    </div>
  );
}
