import "server-only";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import type { ServerFile } from "@/components/wizard/state";
import { ServiceWizard, type ServiceWizardProps } from "@/components/services/service-wizard";
import { Wizard, type WizardProps } from "@/components/wizard/wizard";
import { can } from "@/lib/auth/policies";
import type { CurrentUser } from "@/lib/auth/policies";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { visibleList } from "@/lib/content/lists";
import { contestRepository } from "@/lib/contests/services";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { Lang, ServiceDef } from "@/lib/services/types";
import { getSettings } from "@/lib/settings";
import { openMethods } from "@/lib/payments/methods";
import { getProSettings } from "@/lib/pro/settings";
import { allProIds } from "@/lib/pro/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnboarding } from "@/lib/onboarding/store";

/*
 * Shared by /start (the "What do you need?" page, draft links and the logo wizard's ?step= links) and
 * /start/<service> (owner, 2026-10-13): who may start a contest, the two wizards, and the Coming soon page for a
 * service that is off in Admin → Services.
 */

export type StartParams = Record<string, string | string[] | undefined>;

/** Designers (and anyone else who can't create contests) get this instead of a wizard. */
export async function cannotStart(user: CurrentUser | null) {
  if (can(user, "contest.create")) return null;
  const { t } = await getI18n();
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

/** "<Service> is coming soon": the service is off, so it can't be started (direct links included). */
export async function ComingSoon({ service }: { service: ServiceDef }) {
  const { t, locale } = await getI18n();
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  return (
    <PageShell>
      <Panel tone="grey" className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-xl flex-col items-center gap-3 py-10 text-center" data-coming-soon={service.slug}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECEDF0] px-3 py-1 text-[13px] font-bold text-[#5F626B]">
            <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {t("services.types.soonPage.kicker")}
          </span>
          <h1 className="m-0 text-[clamp(26px,3.2vw,38px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">{t("services.types.soonPage.title", { name: l(service.name) })}</h1>
          <p className="m-0 max-w-[460px] text-[16px] text-muted">{t("services.types.soonPage.text")}</p>
          <ButtonLink href="/start" size="lg" className="mt-2">
            {t("services.types.soonPage.back")}
          </ButtonLink>
        </div>
      </Panel>
    </PageShell>
  );
}

const profileOf = async (user: CurrentUser | null) => {
  if (!user || !isSupabaseConfigured()) return null;
  const { data: profile } = await createAdminClient().from("profiles").select("name, business_name").eq("id", user.id).single();
  // Until the wizard asks for it, a new client's name is a copy of their brand name.
  return { name: profile && profile.name !== profile.business_name ? profile.name : "", mobile: user.mobile };
};

/** The wizard of a non-logo service (fresh, or resuming one of the client's drafts). */
export async function serviceWizard(service: ServiceDef, user: CurrentUser | null, resume: ServiceWizardProps["resume"] = null, startAtPay = false) {
  const [pricing, s, svcUser, inviteFirst, methods] = await Promise.all([getPricingConfig(), getSettings(["auth.password_min_length"]), profileOf(user), invitesAvailable(), payMethods()]);
  return <ServiceWizard key={service.slug} service={service} user={svcUser} pricing={pricing} passwordMin={s["auth.password_min_length"]} resume={resume} inviteFirst={inviteFirst} startAtPay={startAtPay} methods={methods} />;
}

/** The payment methods switched on in Admin › Payments › Methods (owner, 2026-10-14), in the visitor's language. */
async function payMethods() {
  const { locale, currency } = await getI18n();
  return openMethods(locale, currency.code);
}

/** Designer Pro plan (owner, 2026-10-13): the invite step is offered while invitations are on and someone is Pro. */
async function invitesAvailable(): Promise<boolean> {
  const { settings, ready } = await getProSettings();
  return ready && settings.features.invitations && settings.invitesPerContest > 0 && (await allProIds()).length > 0;
}

/** A non-logo draft of this client that can still be finished, or null. */
export async function serviceDraftOf(user: CurrentUser | null, draftId: string | null) {
  if (!user || !draftId || !isSupabaseConfigured()) return null;
  const draft = await contestRepository().findContest(draftId);
  if (!draft || draft.clientId !== user.id || (draft.status !== "draft" && draft.status !== "pending_payment")) return null;
  return draft;
}

/** The original logo wizard, C-01 … C-11 (UI-JOURNEY §4), with its ?step=, ?draft= and ?name= links. */
export async function logoWizard(params: StartParams, user: CurrentUser | null) {
  const [pricing, s, businessTypes, colours, wizardUser, inviteFirst, methods, onboarding] = await Promise.all([
    getPricingConfig(),
    getSettings(["limits.brief_max_files", "limits.brief_file_max_mb", "auth.password_min_length"]),
    visibleList("business_types", "en"),
    visibleList("colours", "en"),
    profileOf(user),
    invitesAvailable(),
    payMethods(),
    getOnboarding("client"),
  ]);

  let previous: WizardProps["previous"] = [];
  let resume: WizardProps["resume"] = null;
  if (user && isSupabaseConfigured()) {
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
        const { data: files } = await createAdminClient()
          .from("contest_files")
          .select("id, original_name, mime_type, type")
          .eq("contest_id", draft.id)
          .order("created_at");
        resume = {
          contestId: draft.id,
          brief: draft.brief,
          order: draft.order,
          files: (files ?? []).map((f): ServerFile => ({ id: f.id, name: f.original_name, type: f.mime_type, isCurrentLogo: f.type === "current_logo" })),
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
      inviteFirst={inviteFirst}
      methods={methods}
      onboarding={onboarding}
    />
  );
}
