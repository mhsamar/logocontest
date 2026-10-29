import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignTypes, DesignTypesHow } from "@/components/services/design-types";
import { PageShell } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { onboardingV2On } from "@/lib/onboarding/v2-steps";
import { awaitingApproval } from "@/lib/payments/manual";
import { getService } from "@/lib/services/store";
import { isLogo, LOGO } from "@/lib/services/types";
import { cannotStart, ComingSoon, logoWizard, serviceDraftOf, serviceWizard } from "./start-flow";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("wizard.meta.title"), robots: { index: false } };
}

// Start a contest (owner, 2026-10-13; Design/home-page/start-contest.html): every design type as a card, on or
// "Coming soon" as set in Admin → Services; a card opens /start/<key>. Older links keep working: ?draft= resumes a
// draft, ?step= / ?name= open the logo wizard, ?service= moves to /start/<key>.
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const params = await searchParams;
  if (typeof params.service === "string" && params.service) redirect(`/start/${encodeURIComponent(params.service)}`);
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const blocked = await cannotStart(user);
  if (blocked) return blocked;

  const draft = await serviceDraftOf(user, typeof params.draft === "string" ? params.draft : null);
  // Its bKash payment is waiting for approval (owner, 2026-10-14): show that instead of paying again.
  const waiting = draft ? (await awaitingApproval([draft.id])).get(draft.id) : undefined;
  if (waiting) redirect(`/pay/contest/${waiting}`);
  // A contest started in onboarding v2 (owner, 2026-10-28) is finished there: dashboard, email and resume links all
  // come through here.
  if (draft?.briefCompletion && onboardingV2On()) redirect(`/start-v2?draft=${draft.id}`);
  if (draft) {
    const service = await getService(draft.service);
    // A draft of a service that is now off can't be finished or paid (the server refuses it too).
    if (service && !service.on) return <ComingSoon service={service} />;
    // A saved draft opens at "Review and pay" (owner, 2026-10-14: "Finish payment" went back to step 1). A service
    // draft is only saved with a complete brief; a logo draft that isn't complete opens at its first unfinished step.
    if (service && !isLogo(service.slug))
      return serviceWizard(service, user, { contestId: draft.id, title: draft.brief.brandName, description: draft.brief.businessDescription, answers: draft.serviceBrief, order: draft.order }, params.step === "pay" || params.step === undefined);
  }
  // A logo-wizard link: a draft, a numbered step (?step=pay|edit belong to another design type's saved contest, which
  // this person can't open), or a name from the home page.
  if (draft || (typeof params.step === "string" && /^\d+$/.test(params.step)) || typeof params.name === "string") {
    const logo = await getService(LOGO);
    if (logo && !logo.on) return <ComingSoon service={logo} />;
    // A new logo contest (an old ?step= or ?name= link) starts in onboarding v2 (owner, 2026-10-29, Phase D); a draft
    // made in the old wizard is finished there.
    if (!draft && onboardingV2On()) redirect("/start-v2");
    return logoWizard(draft && params.step === undefined ? { ...params, step: "8" } : params, user);
  }

  // Frame and heading as in Design/logocontest-site/start-contest.html (owner, 2026-10-29; dt-page in design-types.css).
  const picker = (
    <div className="dt-page">
      <div className="dt-head">
        <span className="dt-sck">{t("services.picker.kicker")}</span>
        <h1>{t("services.picker.title")}</h1>
        <p>{t("services.picker.lead")}</p>
      </div>
      <DesignTypes variant="start" />
      <DesignTypesHow />
      <p className="dt-note">{t("services.types.samples")}</p>
    </div>
  );
  // A signed-in client picks inside the client workspace (start/layout.tsx), so the page frame isn't needed there.
  return user?.role === "client" ? picker : <PageShell>{picker}</PageShell>;
}
