import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeliverFiles } from "@/components/handover/deliver-files";
import { HandoverTracker } from "@/components/handover/tracker";
import { BackLink } from "@/components/ui/back-link";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { latestClaim } from "@/lib/claims/queries";
import { getDesignerHandover } from "@/lib/handover/queries";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("handover.metaTitle"), robots: { index: false } };
}

// D-08 You won + D-09 Deliver files (UI-JOURNEY, owner 2026-10-08).
export default async function DesignerHandoverPage({ params }: PageProps<"/dashboard/handover/[slug]">) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?as=designer&next=${encodeURIComponent(`/dashboard/handover/${slug}`)}`);
  const h = await getDesignerHandover(slug, user.id);
  if (!h) notFound();
  const [{ t, locale }, maxMb, claim] = await Promise.all([getI18n(), getSetting("limits.handover_file_max_mb"), latestClaim(h.id)]);
  const taka = (n: number) => formatTaka(n, locale);
  const editable = h.status === "awaiting_files" || h.status === "revision_requested";

  return (
    <PageShell>
      <BackLink href="/dashboard">{t("nav.dashboard")}</BackLink>
      {/* You won */}
      <section className="relative overflow-clip rounded-[32px] bg-[image:var(--gradient-red-dark)] px-6 py-10 text-white sm:px-10 max-[720px]:rounded-[24px] max-[720px]:px-4 max-[720px]:py-7">
        <div className="mx-auto max-w-3xl">
          <p className="m-0 text-4xl" aria-hidden>
            🏆
          </p>
          <h1 className="m-0 mt-3 text-[clamp(30px,4vw,46px)] font-semibold leading-[1.05] tracking-[-0.04em]">{t("handover.won.title")}</h1>
          <p className="m-0 mt-2 text-white/80">{t("handover.won.line", { prize: taka(h.prize), brand: h.brandName })}</p>
          <dl className="m-0 mt-6 grid grid-cols-3 gap-2 text-center">
            {[
              { label: t("handover.won.prize"), value: taka(h.prize) },
              { label: t("handover.won.fee", { rate: h.feeRate }), value: `− ${taka(h.fee)}` },
              { label: t("handover.won.receive"), value: taka(h.credit), gold: true },
            ].map((s) => (
              <div key={s.label} className="flex flex-col-reverse rounded-[18px] bg-white/10 px-3 py-3 ring-1 ring-white/15">
                <dt className="text-xs text-white/70">{s.label}</dt>
                <dd className={s.gold ? "lc-d m-0 text-xl font-semibold tabular-nums text-gold" : "lc-d m-0 text-lg font-semibold tabular-nums"}>{s.value}</dd>
              </div>
            ))}
          </dl>
          {h.status !== "approved" && <p className="m-0 mt-4 text-sm text-white/80">{t("handover.won.after", { amount: taka(h.credit) })}</p>}
          {editable && <p className="m-0 mt-1 text-sm font-semibold text-gold">{t("handover.won.dueWarn", { date: formatDate(h.dueAt, locale, "long") })}</p>}
        </div>
      </section>

      <Panel tone="grey" className="max-[720px]:py-4">
        <div className="mx-auto max-w-3xl space-y-3.5">

          <div className="lc-card p-5 sm:p-7">
            <HandoverTracker status={h.status} t={t} />
          </div>

          {h.status === "no_result" && <p className="m-0 rounded-[20px] bg-surface px-5 py-4 text-ink">{t("lifecycle.noResultDesigner")}</p>}
          {claim?.status === "open" && (
            <p className="m-0 rounded-[20px] bg-[#fff6d6] px-5 py-4 text-sm font-medium text-gold-ink">{t("claims.designer.open")}</p>
          )}
          {h.status === "revision_requested" && h.revisionNote && (
            <div className="rounded-[20px] bg-[#fff6d6] px-5 py-4">
              <p className="m-0 font-semibold text-gold-ink">{t("handover.revision.title")}</p>
              <p className="m-0 mt-1 whitespace-pre-line text-ink">{h.revisionNote}</p>
            </div>
          )}
          {h.status === "submitted" && h.reviewDueAt && (
            <p className="m-0 rounded-[20px] bg-[#e8f1ff] px-5 py-4 text-[#1d4ed8]">{t("handover.waiting.designer", { date: formatDate(h.reviewDueAt, locale, "long") })}</p>
          )}
          {h.status === "approved" && (
            <div className="flex flex-col items-start gap-3 rounded-[20px] bg-success/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 font-semibold text-success">{t("handover.done.designer", { amount: taka(h.credit) })}</p>
              <Link href="/dashboard/wallet" className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] bg-success px-5 text-[15px] font-bold text-white">
                {t("handover.done.wallet")} <Arrow />
              </Link>
            </div>
          )}

          <div className="lc-card p-5 sm:p-7">
            <DeliverFiles
              handoverId={h.id}
              editable={editable}
              files={h.files}
              extrasAsked={h.deliverables.map((d) => t(`wizard.deliverables.${d}.title`))}
              fontsNote={h.fontsNote ?? ""}
              maxMb={maxMb}
            />
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
