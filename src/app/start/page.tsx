import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ServerFile } from "@/components/wizard/state";
import { Wizard, type WizardProps } from "@/components/wizard/wizard";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { visibleList } from "@/lib/content/lists";
import { contestRepository } from "@/lib/contests/services";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wizard.meta.title"), robots: { index: false } };
}

// Contest wizard, C-01 … C-11 (UI-JOURNEY §4). C-21 when the client is signed in.
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const params = await searchParams;
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);

  if (!can(user, "contest.create")) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-12">
        <EmptyState title={t("wizard.errors.designerAccount")} action={<ButtonLink href="/">{t("notFound.home")}</ButtonLink>} />
      </div>
    );
  }

  const [pricing, s, businessTypes, colours] = await Promise.all([
    getPricingConfig(),
    getSettings(["limits.brief_max_files", "limits.brief_file_max_mb", "auth.password_min_length"]),
    visibleList("business_types", "en"),
    visibleList("colours", "en"),
  ]);

  let wizardUser: WizardProps["user"] = null;
  let previous: WizardProps["previous"] = [];
  let resume: WizardProps["resume"] = null;

  if (user && isSupabaseConfigured()) {
    const db = createAdminClient();
    const { data: profile } = await db.from("profiles").select("name, business_name").eq("id", user.id).single();
    // Until C-11 asks for it, a new client's name is a copy of their brand name.
    wizardUser = { name: profile && profile.name !== profile.business_name ? profile.name : "", mobile: user.mobile };

    const repo = contestRepository();
    const draftId = typeof params.draft === "string" ? params.draft : null;
    const contests = await repo.listByClient(user.id);
    previous = contests
      .filter((c) => c.id !== draftId)
      .slice(0, 5)
      .map((c) => ({ id: c.id, brandName: c.brief.brandName, brief: c.brief }));

    if (draftId) {
      const draft = contests.find((c) => c.id === draftId && (c.status === "draft" || c.status === "pending_payment"));
      if (draft) {
        const { data: files } = await db
          .from("contest_files")
          .select("id, original_name, mime_type, type")
          .eq("contest_id", draft.id)
          .order("created_at");
        resume = {
          contestId: draft.id,
          brief: draft.brief,
          order: draft.order,
          files: (files ?? []).map(
            (f): ServerFile => ({ id: f.id, name: f.original_name, type: f.mime_type, isCurrentLogo: f.type === "current_logo" }),
          ),
        };
      }
    }
  }

  const step = Number(params.step);
  return (
    <Wizard
      user={wizardUser}
      pricing={pricing}
      fileLimits={{ maxFiles: s["limits.brief_max_files"], maxMb: s["limits.brief_file_max_mb"] }}
      passwordMin={s["auth.password_min_length"]}
      previous={previous}
      resume={resume}
      initialStep={Number.isInteger(step) && step >= 1 && step <= 11 ? step : null}
      prefillName={typeof params.name === "string" ? params.name : ""}
      choices={{ businessTypes: businessTypes.map((b) => b.id), swatches: colours.map((c) => c.value ?? "").filter(Boolean) }}
    />
  );
}
