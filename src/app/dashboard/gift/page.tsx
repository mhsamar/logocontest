import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, PageTitle } from "@/components/ui/section-heading";
import { redirect } from "next/navigation";
import { GiftForm } from "@/components/rewards/gift-form";
import { getAgreement } from "@/lib/agreements/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { monthLabel } from "@/lib/notifications/render";
import { myMonthlyWins } from "@/lib/rewards/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("gift.metaTitle"), robots: { index: false } };
}

const local = (e164: string | null | undefined) => (e164 ? `0${e164.replace(/^\+880/, "")}` : "");

// Monthly Winner gift box (owner, 2026-10-09): the winner confirms where to send it.
export default async function GiftPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=designer&next=/dashboard/gift");
  if (user.role !== "designer") redirect("/dashboard");
  const [{ t, locale }, wins, agreement] = await Promise.all([getI18n(), myMonthlyWins(user.id), getAgreement(user.id)]);
  const when = (d: Date) => d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeZone: "Asia/Dhaka" });

  return (
    <PageShell>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle pill={t("gift.eyebrow")} lead={t("gift.title")} />
      </Panel>
      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="mx-auto w-full max-w-2xl">
          {wins.length === 0 ? (
            <EmptyState
              title={t("gift.none")}
              action={
                <ButtonLink href="/leaderboard" variant="secondary">
                  {t("footer.leaderboard")} <Arrow />
                </ButtonLink>
              }
            />
          ) : (
            <ul className="m-0 list-none space-y-3.5 p-0">
              {wins.map((w) => (
                <li key={w.month} className="lc-card p-5 sm:p-7">
                  <p className="m-0 flex items-center gap-2 font-bold text-gold-ink">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                      <path d="M20 12v8H4v-8M2 7h20v5H2ZM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z" strokeLinejoin="round" />
                    </svg>
                    {t("gift.winner", { month: monthLabel(w.month, locale) })}
                  </p>
                  {w.giftStatus === "sent" ? (
                    <p className="mt-3 text-sm text-ink">{t("gift.sent", { date: w.sentAt ? when(w.sentAt) : "", note: w.sentNote ?? "" })}</p>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-muted">{w.giftStatus === "address_given" ? t("gift.received") : t("gift.lead")}</p>
                      <div className="mt-4">
                        <GiftForm
                          month={w.month}
                          initial={{
                            name: w.ship.name ?? agreement?.fullName ?? user.name,
                            phone: local(w.ship.phone ?? agreement?.mobile ?? user.mobile),
                            address: w.ship.address ?? agreement?.address ?? "",
                          }}
                        />
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
