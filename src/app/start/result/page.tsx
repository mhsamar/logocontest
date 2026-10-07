import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { ContestLive } from "@/components/wizard/contest-live";
import { getCurrentUser } from "@/lib/auth/session";
import { contestRepository } from "@/lib/contests/services";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { robots: { index: false } };

// C-11b (payment failed or cancelled) and C-12 (contest live).
export default async function PaymentResultPage({ searchParams }: PageProps<"/start/result">) {
  const { payment: paymentId } = await searchParams;
  const user = await getCurrentUser();
  if (!isSupabaseConfigured() || !user || typeof paymentId !== "string" || !/^[0-9a-f-]{36}$/.test(paymentId)) notFound();

  const repo = contestRepository();
  const payment = await repo.findPayment(paymentId);
  if (!payment || payment.clientId !== user.id) notFound();
  const contest = await repo.findContest(payment.contestId);
  if (!contest) notFound();

  const { t, locale } = await getI18n();

  if (payment.status === "paid" && contest.endsAt) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    const judgingDays = await getSetting("timers.judging_window_days");
    const pickBy = new Date(contest.endsAt.getTime() + judgingDays * 86_400_000);
    return (
      <ContestLive
        url={`${origin}/contest/${contest.slug}`}
        pickBy={new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(pickBy)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 8v5m0 3h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="mt-5 text-h2 font-bold text-ink">{t("wizard.result.failedTitle")}</h1>
      <p className="mt-2 text-muted">{t("wizard.result.failedBody")}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href={`/start?draft=${contest.id}&step=11`} size="lg">
          {t("wizard.result.tryAgain")}
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary" size="lg">
          {t("wizard.result.dashboard")}
        </ButtonLink>
      </div>
    </div>
  );
}
