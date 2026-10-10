import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MyChecksList } from "@/components/logo-check/my-checks";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { myChecks } from "@/lib/logo-check/queries";
import { runLogoCheck } from "@/lib/logo-check/run";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("checker.my.title"), robots: { index: false } };
}

// My logo checks (owner, 2026-10-10; Design/copyright-checker/client-my-logo-checks.html): every AI check, its
// result and certificate, and the checks left in each contest. "See result" opens the pop-up on step 3.
export default async function MyLogoChecksPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?as=client&next=/dashboard/logo-checks");
  if (user.role !== "client") notFound();
  const data = await myChecks(user.id);

  // A check whose runner stopped (the server restarted mid-check) carries on from here.
  const stale = data.checks.filter((c) => c.stale);
  if (stale.length) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    after(async () => {
      for (const c of stale) await runLogoCheck(c.id, origin);
    });
  }

  return (
    <PageShell>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle lead={t("checker.my.title")} sub={t("checker.my.lead")} />
      </Panel>
      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <MyChecksList checks={data.checks} contests={data.contests} limit={data.limits.perContest} lens={Boolean(process.env.SEARCHAPI_API_KEY)} />
      </Panel>
    </PageShell>
  );
}
