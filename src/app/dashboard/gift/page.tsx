import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
      <p className="animate-rise text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("gift.eyebrow")}</p>
      <h1 className="mt-2 animate-rise text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("gift.title")}</h1>
      {wins.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">
          {t("gift.none")}{" "}
          <Link href="/leaderboard" className="font-semibold text-primary hover:underline">
            {t("footer.leaderboard")} →
          </Link>
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {wins.map((w) => (
            <li key={w.month} className="animate-rise rounded-3xl bg-gradient-to-br from-[#fff7e0] to-white p-5 shadow-card ring-1 ring-[#f4d58a] sm:p-6">
              <p className="flex items-center gap-2 font-bold text-[#8a5105]">
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
  );
}
