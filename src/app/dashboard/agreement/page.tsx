import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgreementForm } from "@/components/agreement/agreement-form";
import { getAgreement } from "@/lib/agreements/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { agreementText } from "@/lib/legal";
import { formatBdMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("agreement.metaTitle"), robots: { index: false } };
}

const safeNext = (v: unknown) => (typeof v === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : "/contests");

// D-12 Originality agreement (BLUEPRINT §9.6, owner 2026-10-09): once, before the first design.
export default async function AgreementPage({ searchParams }: PageProps<"/dashboard/agreement">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=designer&next=${encodeURIComponent(`/dashboard/agreement?next=${next}`)}`);
  if (user.role !== "designer") redirect("/dashboard");
  const [{ t, locale }, signed] = await Promise.all([getI18n(), getAgreement(user.id)]);
  const text = agreementText(locale);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
      <p className="animate-rise text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("agreement.eyebrow")}</p>
      <h1 className="mt-2 animate-rise text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{text.title}</h1>

      {signed ? (
        <>
          <p className="mt-2 text-muted">{t("agreement.signed.lead")}</p>
          <section className="mt-6 animate-rise rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6">
            <p className="flex items-center gap-2 font-semibold text-success">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("agreement.signed.title", { date: formatDate(signed.signedAt, locale, "long") })}
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                [t("agreement.fullName"), signed.fullName],
                [t("agreement.mobile"), formatBdMobile(signed.mobile)],
                [t(`agreement.idNumber.${signed.idType}`), signed.idMasked],
                [
                  t("agreement.signed.time"),
                  signed.signedAt.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }),
                ],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted">{t("agreement.signed.change")}</p>
          </section>
          <details className="mt-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
            <summary className="cursor-pointer font-semibold text-ink">{t("agreement.signed.readAgain")}</summary>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed text-ink">
              {text.clauses.map((c, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-5 shrink-0 font-semibold text-primary">{i + 1}.</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </details>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={next} className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 font-semibold text-white hover:bg-primary-dark">
              {t("agreement.signed.continue")}
            </Link>
            <Link href="/legal/designer-rules" className="inline-flex min-h-12 items-center rounded-full px-4 font-semibold text-primary hover:underline">
              {t("footer.designerRules")} →
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 animate-rise text-muted">{t("agreement.lead")}</p>
          <div className="mt-6">
            <AgreementForm defaults={{ fullName: user.name, mobile: user.mobile ? `0${user.mobile.replace(/^\+880/, "")}` : "" }} text={text} next={next} />
          </div>
        </>
      )}
    </div>
  );
}
