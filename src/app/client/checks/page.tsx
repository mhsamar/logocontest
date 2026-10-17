import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MyChecksList } from "@/components/logo-check/my-checks";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { myChecks } from "@/lib/logo-check/queries";
import { runLogoCheck } from "@/lib/logo-check/run";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("checker.my.title"), robots: { index: false } };
}

// Premium client workspace › Logo checks (owner, 2026-10-17: the right-side menu stays on every client page). The
// same list as before: every AI check, its result and certificate, and the checks left in each contest.
export default async function ClientChecksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fchecks");
  if (user.role !== "client") redirect("/dashboard/logo-checks");
  const [{ t }, data] = await Promise.all([getI18n(), myChecks(user.id)]);

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
    <>
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("checker.my.title")}</h1>
          </div>
          <p>{t("checker.my.lead")}</p>
        </div>
      </div>
      <MyChecksList checks={data.checks} contests={data.contests} lens={Boolean(process.env.SEARCHAPI_API_KEY)} />
    </>
  );
}
