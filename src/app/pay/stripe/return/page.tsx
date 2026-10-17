import { contestHref } from "@/lib/client/rules";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { getI18n } from "@/lib/i18n/server";
import { retrieveSession } from "@/lib/payments/stripe-api";
import { stripeReady } from "@/lib/payments/stripe-config";
import { settleSession, type SettleResult } from "@/lib/payments/stripe-settle";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.page.metaTitle"), robots: { index: false } };
}
export const dynamic = "force-dynamic";

/** Where each kind of payment shows its result (the same pages a paid or failed payment always uses). */
function resultPath(r: SettleResult): string {
  const ok = r.status === "paid";
  if (r.kind === "contest") return `/start/result?payment=${r.paymentId}`;
  if (r.kind === "addon") return r.slug ? contestHref(r.slug, "payment", { payment: ok ? "paid" : "failed" }) : "/client";
  return `/pro/checkout?status=${ok ? "success" : "failed"}&payment=${r.paymentId}`;
}

// Back from Stripe (owner, 2026-10-14): the session is checked with Stripe and settled here (the webhook does the
// same; whichever comes first wins), then the usual result page opens. A payment Stripe is still confirming shows
// a short wait that reloads itself.
export default async function StripeReturnPage({ searchParams }: PageProps<"/pay/stripe/return">) {
  const sp = await searchParams;
  const id = typeof sp.session_id === "string" ? sp.session_id : "";
  const { t } = await getI18n();
  const session = stripeReady() && id ? await retrieveSession(id) : null;
  const result = session ? await settleSession(session) : null;
  if (result && (result.status === "paid" || result.status === "failed")) redirect(resultPath(result));

  const waiting = result?.status === "pending";
  return (
    <PageShell>
      {waiting && <meta httpEquiv="refresh" content="4" />}
      <Panel tone="grey" className="flex flex-1 flex-col items-center justify-center max-[720px]:bg-surface">
        <div className="w-full max-w-xl text-center min-[721px]:rounded-[28px] min-[721px]:border min-[721px]:border-line min-[721px]:bg-surface min-[721px]:p-10 min-[721px]:shadow-card" data-stripe-return={waiting ? "waiting" : "error"}>
          <h1 className="m-0 text-[clamp(28px,3.4vw,40px)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{waiting ? t("pay.stripe.returnTitle") : t("pay.stripe.failedTitle")}</h1>
          <p className="m-0 mt-2.5 text-[17px] text-muted">{waiting ? t("pay.stripe.returnLead") : t("pay.stripe.failedLead")}</p>
          {!waiting && (
            <div className="mt-8 flex justify-center">
              <ButtonLink href={result?.kind === "pro" ? "/dashboard" : "/client"} size="lg">
                {t("pay.page.toDashboard")}
              </ButtonLink>
            </div>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}
