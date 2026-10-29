import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { DesignerChecks } from "@/components/pro/designer-checks";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("checker.my.title"), robots: { index: false } };
}

// My logo checks (owner, 2026-10-10). Designers check their own logos here (owner, 2026-10-13: Basic 2 a month;
// 2026-10-29: Pro 20); a client's checks are in the client workspace at /client/checks (owner, 2026-10-17).
export default async function MyLogoChecksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=/dashboard/logo-checks");
  if (user.role === "designer") return <DesignerChecks user={user} />;
  if (user.role === "client") redirect("/client/checks");
  notFound();
}
