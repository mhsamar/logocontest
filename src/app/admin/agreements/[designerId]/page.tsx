import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { getAgreement, signedAgreementText } from "@/lib/agreements/queries";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import { agreementText } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.agreements.readSigned"), robots: { index: false } };
}

// A-13 "Read signed agreement" (owner, 2026-10-12): the exact text the designer signed when it was kept (signatures
// from 12 October 2026 on), otherwise today's agreement text, saying so. No ID number or photo here.
export default async function SignedAgreementPage({ params }: PageProps<"/admin/agreements/[designerId]">) {
  await requirePermission("agreements.view");
  const { designerId } = await params;
  const [{ t, locale }, signed, who] = await Promise.all([getI18n(), signedAgreementText(designerId), getAgreement(designerId)]);
  if (!signed || !who) notFound();
  const text = signed.text ?? (await agreementText(locale));
  const date = signed.signedAt.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Link href="/admin/agreements" className="text-sm font-bold text-primary">
        ← {t("admin.agreements.signedPage.back")}
      </Link>
      <h1 className="lc-d m-0 text-[28px] font-semibold tracking-[-0.03em] text-ink">{t("admin.agreements.signedPage.title", { name: who.fullName })}</h1>
      <p className={signed.text ? "m-0 rounded-xl bg-[#E3F3EA] px-4 py-3 text-sm font-semibold text-[#14633C]" : "m-0 rounded-xl bg-[#FFF4D1] px-4 py-3 text-sm font-semibold text-[#6B4E00]"}>
        {signed.text ? t("admin.agreements.signedPage.exact", { name: who.fullName, version: signed.version }) : t("admin.agreements.signedPage.today", { version: signed.version })}
      </p>
      <article className="rounded-2xl border border-[#E9EAEE] bg-white p-5 sm:p-7">
        <h2 className="m-0 text-xl font-semibold text-ink">{text.title}</h2>
        <p className="m-0 mt-3 whitespace-pre-line text-[15px] text-ink">{text.intro}</p>
        <ol className="m-0 mt-3 list-decimal space-y-2 pl-5 text-[15px] text-ink">
          {text.clauses.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
        <p className="m-0 mt-3 whitespace-pre-line text-[15px] text-ink">{text.closing}</p>
        <p className="m-0 mt-5 border-t border-line pt-4 text-sm font-semibold text-muted">{t("admin.agreements.signedPage.signedBy", { signature: signed.signature, date })}</p>
      </article>
    </div>
  );
}
