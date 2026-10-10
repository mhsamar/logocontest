import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgreementForm } from "@/components/agreement/agreement-form";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, PageTitle } from "@/components/ui/section-heading";
import { getAgreement } from "@/lib/agreements/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { agreementText } from "@/lib/legal";
import { resignSince } from "@/lib/legal/store";
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
  const [{ t, locale }, found, since] = await Promise.all([getI18n(), getAgreement(user.id), resignSince()]);
  const text = await agreementText(locale);
  // An admin can publish a new agreement and ask everyone to sign again (A-16).
  const outdated = !!found && !!since && found.signedAt < since;
  const signed = outdated ? null : found;

  return (
    <PageShell>
      <Panel as="header" className="max-[720px]:py-6">
        <PageTitle pill={t(outdated ? "agreement.eyebrowUpdated" : "agreement.eyebrow")} lead={text.title} sub={signed ? t("agreement.signed.lead") : t(outdated ? "agreement.updated" : "agreement.lead")} />
      </Panel>

      <Panel tone="grey" className="flex-1 max-[720px]:py-4">
        <div className="mx-auto w-full max-w-2xl">
          {signed ? (
            <>
              <section className="lc-card p-5 sm:p-7">
                <p className="m-0 flex items-center gap-2 font-semibold text-success">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t("agreement.signed.title", { date: formatDate(signed.signedAt, locale, "long") })}
                </p>
                <dl className="m-0 mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                  {[
                    [t("agreement.fullName"), signed.fullName],
                    [t("agreement.mobile"), formatBdMobile(signed.mobile)],
                    [t(`agreement.idNumber.${signed.idType}`), signed.idMasked],
                    [
                      t("agreement.signed.time"),
                      signed.signedAt.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }),
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[16px] bg-chip px-4 py-3">
                      <dt className="text-xs font-bold uppercase tracking-wide text-muted">{k}</dt>
                      <dd className="m-0 mt-0.5 font-semibold text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="m-0 mt-4 text-sm text-muted">{t("agreement.signed.change")}</p>
              </section>
              <details className="lc-card mt-3.5 rounded-[22px] p-5">
                <summary className="cursor-pointer font-bold text-ink">{t("agreement.signed.readAgain")}</summary>
                <ol className="m-0 mt-3 list-none space-y-2 p-0 text-sm leading-relaxed text-ink">
                  {text.clauses.map((c, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-5 shrink-0 font-bold text-primary">{i + 1}.</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ol>
              </details>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href={next} size="lg">
                  {t("agreement.signed.continue")}
                </ButtonLink>
                <Link href="/legal/designer-rules" className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 font-bold text-primary hover:underline">
                  {t("footer.designerRules")} <Arrow />
                </Link>
              </div>
            </>
          ) : (
            <AgreementForm defaults={{ fullName: user.name, mobile: user.mobile ? `0${user.mobile.replace(/^\+880/, "")}` : "" }} text={text} next={next} />
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
