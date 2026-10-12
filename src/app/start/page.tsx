import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import type { ServerFile } from "@/components/wizard/state";
import { ServicePicker } from "@/components/services/service-picker";
import { ServiceWizard, type ServiceWizardProps } from "@/components/services/service-wizard";
import { Wizard, type WizardProps } from "@/components/wizard/wizard";
import { can } from "@/lib/auth/policies";
import { getCurrentUser } from "@/lib/auth/session";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { visibleList } from "@/lib/content/lists";
import { contestRepository } from "@/lib/contests/services";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { activeServices } from "@/lib/services/store";
import { isLogo, LOGO } from "@/lib/services/types";
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
      <PageShell>
        <Panel tone="grey" className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xl">
            <EmptyState title={t("wizard.errors.designerAccount")} action={<ButtonLink href="/">{t("notFound.home")}</ButtonLink>} />
          </div>
        </Panel>
      </PageShell>
    );
  }

  const [pricing, s, businessTypes, colours, services] = await Promise.all([
    getPricingConfig(),
    getSettings(["limits.brief_max_files", "limits.brief_file_max_mb", "auth.password_min_length"]),
    visibleList("business_types", "en"),
    visibleList("colours", "en"),
    activeServices(),
  ]);

  // Contest services (owner, 2026-10-13): a non-logo service has its own wizard; with more than one service on, a
  // fresh start asks "What do you need?" first. Logo keeps the original wizard (and its ?step= / ?draft= links).
  const wanted = typeof params.service === "string" ? params.service : null;
  const draftParam = typeof params.draft === "string" ? params.draft : null;
  const logoOn = services.some((x) => x.slug === LOGO);
  let serviceDraft: ServiceWizardProps["resume"] = null;
  let draftService: string | null = null;
  if (user && draftParam && isSupabaseConfigured()) {
    const draft = await contestRepository().findContest(draftParam);
    if (draft && draft.clientId === user.id && (draft.status === "draft" || draft.status === "pending_payment") && !isLogo(draft.service)) {
      draftService = draft.service;
      serviceDraft = { contestId: draft.id, title: draft.brief.brandName, description: draft.brief.businessDescription, answers: draft.serviceBrief, order: draft.order };
    }
  }
  const chosen = services.find((x) => x.slug === (draftService ?? wanted)) ?? (services.length === 1 ? services[0] : null);
  const freshStart = !wanted && !draftParam && params.step === undefined;
  if (chosen && !isLogo(chosen.slug)) {
    let svcUser: ServiceWizardProps["user"] = null;
    if (user && isSupabaseConfigured()) {
      const { data: profile } = await createAdminClient().from("profiles").select("name, business_name").eq("id", user.id).single();
      svcUser = { name: profile && profile.name !== profile.business_name ? profile.name : "", mobile: user.mobile };
    }
    return <ServiceWizard key={chosen.slug} service={chosen} user={svcUser} pricing={pricing} passwordMin={s["auth.password_min_length"]} resume={serviceDraft} />;
  }
  if ((services.length > 1 && freshStart) || (!chosen && !logoOn)) return <ServicePicker services={services} />;

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
