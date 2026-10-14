import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CopyButton, PayForm } from "@/components/payments/pay-form";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { isManualKind, payTarget, type PayTarget } from "@/lib/payments/manual";
import { showMobile } from "@/lib/payments/manual-rules";
import { methodRows } from "@/lib/payments/methods";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.page.metaTitle"), robots: { index: false } };
}

const ICON = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  warn: <path d="M12 8v5m0 3h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />,
};

function Badge({ tone, icon }: { tone: "ok" | "wait" | "bad"; icon: keyof typeof ICON }) {
  const cls = tone === "ok" ? "bg-[#e7f8f0] text-[#0f6b45]" : tone === "wait" ? "bg-[#fff4dc] text-[#9a6200]" : "bg-danger/10 text-danger";
  return (
    <div className={`mx-auto flex size-16 items-center justify-center rounded-[20px] ${cls}`}>
      <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICON[icon]}
      </svg>
    </div>
  );
}

const Box = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-xl min-[721px]:rounded-[28px] min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-10 min-[721px]:shadow-card">{children}</div>
);

// Manual bKash payment (owner, 2026-10-14): send money to the number, give the transaction ID, wait for approval.
// Also shows the result: waiting, approved, or rejected with the reason (they can send the right ID again).
export default async function PayPage({ params }: PageProps<"/pay/[kind]/[id]">) {
  const { kind, id } = await params;
  if (!isSupabaseConfigured() || !isManualKind(kind)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/pay/${kind}/${id}`)}`);
  const target = await payTarget(kind, id);
  if (!target || target.userId !== user.id) notFound();

  const { t, locale } = await getI18n();
  const taka = (n: number) => formatTaka(n, locale);
  const row = (await methodRows()).find((r) => r.key === target.method) ?? null;
  const number = row?.number ?? null;
  const note = (locale === "bn" ? row?.noteBn : row?.noteEn) ?? row?.noteEn ?? null;
  const what = forWhat(target, t);
  const back = backLink(target, t);
  const proof = target.proof;

  // Approved (or paid another way).
  if (target.state === "paid")
    return (
      <PageShell>
        <Panel tone="grey" className="flex flex-1 flex-col items-center justify-center max-[720px]:bg-surface">
          <Box>
            <div className="text-center">
              <Badge tone="ok" icon="check" />
              <h1 className="m-0 mt-5 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{t("pay.page.paidTitle")}</h1>
              <p className="m-0 mt-2.5 text-[17px] text-muted">{t(kind === "contest" ? "pay.page.paidContest" : kind === "addon" ? "pay.page.paidAddon" : "pay.page.paidPro")}</p>
              <p className="m-0 mt-1 text-[15px] text-muted">{what}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <ButtonLink href={back.href} size="lg">
                  {back.label}
                </ButtonLink>
              </div>
            </div>
          </Box>
        </Panel>
      </PageShell>
    );

  // Failed or cancelled: start again.
  if (target.state === "closed")
    return (
      <PageShell>
        <Panel tone="grey" className="flex flex-1 flex-col items-center justify-center max-[720px]:bg-surface">
          <Box>
            <div className="text-center">
              <Badge tone="bad" icon="warn" />
              <h1 className="m-0 mt-5 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{t("pay.page.closedTitle")}</h1>
              <p className="m-0 mt-2.5 text-[17px] text-muted">{t("pay.page.closedLead")}</p>
              <div className="mt-8 flex justify-center">
                <ButtonLink href={back.href} size="lg">
                  {back.label}
                </ButtonLink>
              </div>
            </div>
          </Box>
        </Panel>
      </PageShell>
    );

  // Sent: "Your payment is successful … we will notify you", waiting for an admin.
  if (proof?.status === "pending")
    return (
      <PageShell>
        <Panel tone="grey" className="flex flex-1 flex-col items-center justify-center max-[720px]:bg-surface">
          <Box>
            <div className="text-center" data-pay-state="waiting">
              <Badge tone="ok" icon="check" />
              <h1 className="m-0 mt-5 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{t("pay.page.successTitle")}</h1>
              <p className="m-0 mt-2.5 text-[17px] text-ink">{t(kind === "contest" ? "pay.page.successContest" : kind === "addon" ? "pay.page.successAddon" : "pay.page.successPro")}</p>
              <div className="mx-auto mt-6 flex max-w-sm flex-col gap-1.5 rounded-[18px] bg-[#fff8e6] px-5 py-4 text-left">
                <span className="inline-flex items-center gap-2 text-[15px] font-bold text-[#9a6200]">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                    {ICON.clock}
                  </svg>
                  {t("pay.page.waitingTitle")}
                </span>
                <span className="text-[15px] text-ink">{t("pay.page.waitingLead", { txn: proof.txnId })}</span>
                <span className="text-sm text-muted">
                  {what} · {taka(target.amount)} · {t("pay.page.sentAt", { date: formatDate(proof.createdAt, locale, "short") })}
                </span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <ButtonLink href={back.href} size="lg">
                  {back.label}
                </ButtonLink>
                {kind !== "pro" && (
                  <ButtonLink href="/dashboard" variant="secondary" size="lg">
                    {t("pay.page.toDashboard")}
                  </ButtonLink>
                )}
              </div>
            </div>
          </Box>
        </Panel>
      </PageShell>
    );

  // Open: how to pay, and the form (again after a rejection, with the reason).
  const merchant = target.method === "bkash_merchant";
  return (
    <PageShell>
      <Panel tone="grey" className="flex flex-1 flex-col items-center justify-center max-[720px]:bg-surface">
        <Box>
          <div className="flex flex-col gap-6" data-pay-state="open">
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-muted">{what}</span>
              <h1 className="m-0 text-[clamp(26px,3.2vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">{t("pay.page.titleManual", { method: t(`pay.methods.${target.method}`) })}</h1>
            </div>

            {proof?.status === "rejected" && (
              <div role="alert" className="flex flex-col gap-1 rounded-[16px] bg-danger/10 px-4 py-3.5 text-[15px] text-danger">
                <strong>{t("pay.page.rejectedTitle")}</strong>
                {proof.note && <span>{t("pay.page.rejectedLead", { reason: proof.note })}</span>}
                <span>{t("pay.page.rejectedAgain")}</span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-[18px] bg-tint px-4 py-3.5">
                <span className="text-sm font-semibold text-muted">{t("pay.page.amount")}</span>
                <span className="flex items-center justify-between gap-2">
                  <strong className="lc-d text-[28px] font-semibold tracking-[-0.03em] text-primary tabular-nums">{taka(target.amount)}</strong>
                  <CopyButton value={String(target.amount)} label={t("pay.page.copy")} done={t("pay.page.copied")} />
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-[18px] bg-[#fdeef5] px-4 py-3.5">
                <span className="text-sm font-semibold text-muted">{t("pay.page.sendTo")}</span>
                <span className="flex items-center justify-between gap-2">
                  <strong className="font-mono text-[22px] font-bold tracking-tight text-[#b0105a] tabular-nums">{showMobile(number)}</strong>
                  {number && <CopyButton value={number.replace(/^\+88/, "")} label={t("pay.page.copy")} done={t("pay.page.copied")} />}
                </span>
                <span className="text-[13.5px] text-muted">{t(merchant ? "pay.page.merchantHow" : "pay.page.personalHow")}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="m-0 text-base font-semibold text-ink">{t("pay.page.stepsTitle")}</h2>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {[
                  t("pay.page.step1", { action: t(merchant ? "pay.page.actionPay" : "pay.page.actionSend") }),
                  t("pay.page.step2", { amount: taka(target.amount), number: showMobile(number) }),
                  t("pay.page.step3"),
                ].map((s, i) => (
                  <li key={i} className="flex gap-3 text-[15.5px] text-ink">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
              {note && <p className="m-0 rounded-[14px] bg-frame px-4 py-3 text-[14.5px] text-ink">{note}</p>}
            </div>

            <PayForm kind={kind} paymentId={target.paymentId} />
            <p className="m-0 text-center text-sm text-muted">{t("pay.page.keepMessage")}</p>
          </div>
        </Box>
      </Panel>
    </PageShell>
  );
}

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

function forWhat(p: PayTarget, t: T): string {
  if (p.kind === "pro") return t("pay.page.forPro");
  const brand = p.contest?.brand ?? "";
  if (p.kind === "contest") return t("pay.page.forContest", { brand });
  return p.item.days ? t("pay.page.forExtension", { days: p.item.days, brand }) : t("pay.page.forAddon", { brand });
}

function backLink(p: PayTarget, t: T): { href: string; label: string } {
  if (p.kind === "pro") return { href: "/pro", label: t("pay.page.toPro") };
  if (p.contest) return { href: `/dashboard/contests/${p.contest.slug}`, label: t("pay.page.toContest") };
  return { href: "/dashboard", label: t("pay.page.toDashboard") };
}
