import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { getService } from "@/lib/services/store";
import { isLogo } from "@/lib/services/types";
import { cannotStart, ComingSoon, inWorkspace, logoWizard, serviceWizard } from "../start-flow";

export async function generateMetadata({ params }: PageProps<"/start/[service]">): Promise<Metadata> {
  const [{ t, locale }, service] = await Promise.all([getI18n(), getService((await params).service)]);
  const name = service ? (locale === "bn" ? service.name.bn || service.name.en : service.name.en) : "";
  return { title: name ? `${name} · ${t("wizard.meta.title")}` : t("wizard.meta.title"), robots: { index: false } };
}

// /start/<key> (owner, 2026-10-13): the wizard of one design type. A type that is off in Admin → Services shows
// "Coming soon" instead, so a direct link can't start it either.
export default async function StartServicePage({ params, searchParams }: PageProps<"/start/[service]">) {
  const [{ service: slug }, query] = await Promise.all([params, searchParams]);
  const service = await getService(slug);
  if (!service || service.slug !== slug) notFound();
  const user = await getCurrentUser();
  const blocked = await cannotStart(user);
  if (blocked) return blocked;
  if (!service.on) return <ComingSoon service={service} />;
  return inWorkspace(user, isLogo(service.slug) ? await logoWizard(query, user) : await serviceWizard(service, user));
}
