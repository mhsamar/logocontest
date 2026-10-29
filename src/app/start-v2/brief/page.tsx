import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BriefHub } from "@/components/wizard-v2/brief-hub";
import { getCurrentUser } from "@/lib/auth/session";
import { contestRepository } from "@/lib/contests/services";
import { visibleList } from "@/lib/content/lists";
import { getI18n } from "@/lib/i18n/server";
import { getOnboarding } from "@/lib/onboarding/store";
import { onboardingV2On } from "@/lib/onboarding/v2-steps";
import { awaitingApproval } from "@/lib/payments/manual";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitesAvailable } from "../../start/start-flow";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wizardV2.hub.title"), robots: { index: false } };
}

/**
 * Onboarding v2's brief after paying (owner, 2026-10-29; client-onboarding-v2-spec.md §3): the brief already filled in
 * from the business type, as four cards the client can change one at a time, or finish with one tap. Only the
 * contest's client, only while its brief can change (unpaid, waiting for approval or live).
 */
export default async function BriefHubPage({ searchParams }: PageProps<"/start-v2/brief">) {
  if (!onboardingV2On()) notFound();
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const id = typeof params.c === "string" && /^[0-9a-f-]{36}$/i.test(params.c) ? params.c : null;
  if (!id) notFound();
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent(`/start-v2/brief?c=${id}`)}`);
  const contest = user.role === "client" ? await contestRepository().findContest(id) : null;
  if (!contest || contest.clientId !== user.id || !contest.briefCompletion) notFound();
  if (!["draft", "pending_payment", "open"].includes(contest.status)) redirect(`/client/contests/${contest.slug}`);

  const [types, colours, onboarding, waiting, invites, s, { data: files }] = await Promise.all([
    visibleList("business_types", "en"),
    visibleList("colours", "en"),
    getOnboarding("client"),
    awaitingApproval([contest.id]),
    invitesAvailable(),
    getSettings(["limits.brief_max_files", "limits.brief_file_max_mb"]),
    createAdminClient().from("contest_files").select("id, original_name, mime_type, type").eq("contest_id", contest.id).order("created_at"),
  ]);
  return (
    <BriefHub
      contestId={contest.id}
      slug={contest.slug}
      brief={contest.brief}
      completion={contest.briefCompletion}
      live={contest.status === "open"}
      paid={contest.status === "open" || waiting.has(contest.id)}
      choices={{ businessTypes: types.map((b) => b.id), swatches: colours.map((c) => c.value ?? "").filter(Boolean) }}
      onboarding={onboarding}
      invites={invites}
      // Reference pictures (owner, 2026-10-29), unless Admin › Onboarding hides them.
      photos={
        onboarding.hidden.includes("files")
          ? null
          : {
              files: (files ?? []).map((f) => ({ id: f.id as string, name: f.original_name as string, type: f.mime_type as string, isCurrentLogo: f.type === "current_logo" })),
              limits: { maxFiles: s["limits.brief_max_files"], maxMb: s["limits.brief_file_max_mb"] },
            }
      }
    />
  );
}
