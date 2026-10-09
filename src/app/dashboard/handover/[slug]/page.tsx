import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeliverFiles } from "@/components/handover/deliver-files";
import { HandoverTracker } from "@/components/handover/tracker";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
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
  const [{ t, locale }, maxMb] = await Promise.all([getI18n(), getSetting("limits.handover_file_max_mb")]);
  const taka = (n: number) => formatTaka(n, locale);
  const editable = h.status === "awaiting_files" || h.status === "revision_requested";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
      {/* You won */}
      <section className="relative animate-rise overflow-clip rounded-[2rem] bg-gradient-to-br from-[#1f0a05] via-[#3a1208] to-primary-dark p-6 text-white shadow-raised sm:p-8">
        <span className="pointer-events-none absolute -right-10 -top-12 size-48 animate-float-soft rounded-full bg-[#f4bd2f]/25 blur-2xl" aria-hidden />
        <p className="text-4xl" aria-hidden>
          🏆
        </p>
        <h1 className="mt-2 text-h1 font-bold tracking-tight lg:text-4xl">{t("handover.won.title")}</h1>
        <p className="mt-1 text-white/80">{t("handover.won.line", { prize: taka(h.prize), brand: h.brandName })}</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: t("handover.won.prize"), value: taka(h.prize) },
            { label: t("handover.won.fee", { rate: h.feeRate }), value: `− ${taka(h.fee)}` },
            { label: t("handover.won.receive"), value: taka(h.credit), gold: true },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15">
              <dt className="text-xs text-white/70">{s.label}</dt>
              <dd className={s.gold ? "prize-text text-xl font-extrabold tabular-nums" : "text-lg font-bold tabular-nums"}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {h.status !== "approved" && <p className="mt-4 text-sm text-white/80">{t("handover.won.after", { amount: taka(h.credit) })}</p>}
        {editable && <p className="mt-1 text-sm font-semibold text-[#f6d98b]">{t("handover.won.dueWarn", { date: formatDate(h.dueAt, locale, "long") })}</p>}
      </section>

      <div className="mt-6 animate-rise rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6" style={{ animationDelay: "120ms" }}>
        <HandoverTracker status={h.status} t={t} />
      </div>

      {h.status === "revision_requested" && h.revisionNote && (
        <div className="mt-6 animate-rise rounded-2xl bg-[#fff7e0] p-4 ring-1 ring-[#f1c75c]/60">
          <p className="font-semibold text-[#8a5105]">{t("handover.revision.title")}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{h.revisionNote}</p>
        </div>
      )}
      {h.status === "submitted" && h.reviewDueAt && (
        <p className="mt-6 rounded-2xl bg-[#e8f1ff] p-4 text-[#1d4ed8] ring-1 ring-[#bcd0ff]">{t("handover.waiting.designer", { date: formatDate(h.reviewDueAt, locale, "long") })}</p>
      )}
      {h.status === "approved" && (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-success/10 p-4 ring-1 ring-success/30 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-success">{t("handover.done.designer", { amount: taka(h.credit) })}</p>
          <Link href="/dashboard/wallet" className="inline-flex min-h-11 items-center rounded-full bg-success px-5 text-sm font-semibold text-white">
            {t("handover.done.wallet")} →
          </Link>
        </div>
      )}

      <div className="mt-6 animate-rise rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6" style={{ animationDelay: "200ms" }}>
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
  );
}
