import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DesignTypes, DesignTypesHow } from "@/components/services/design-types";
import { PageShell } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
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
  if (draft) {
    const service = await getService(draft.service);
    // A draft of a service that is now off can't be finished or paid (the server refuses it too).
    if (service && !service.on) return <ComingSoon service={service} />;
    if (service && !isLogo(service.slug))
      return serviceWizard(service, user, { contestId: draft.id, title: draft.brief.brandName, description: draft.brief.businessDescription, answers: draft.serviceBrief, order: draft.order }, params.step === "pay");
  }
  if (draft || params.step !== undefined || typeof params.name === "string") {
    const logo = await getService(LOGO);
    if (logo && !logo.on) return <ComingSoon service={logo} />;
    return logoWizard(params, user);
  }

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-1 py-4">
        <div className="flex flex-col gap-2">
          <span className="self-start rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-primary">{t("services.picker.kicker")}</span>
          <h1 className="m-0 text-[clamp(28px,3.4vw,42px)] font-semibold leading-[1.06] tracking-[-0.04em] text-ink">{t("services.picker.title")}</h1>
          <p className="m-0 max-w-[620px] text-[17px] text-muted">{t("services.picker.lead")}</p>
        </div>
        <DesignTypes variant="start" />
        <DesignTypesHow />
        <p className="dt-note">{t("services.types.samples")}</p>
      </div>
    </PageShell>
  );
}
