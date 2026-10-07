import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { getFakeGateway } from "@/lib/payments";

export const metadata: Metadata = { robots: { index: false } };

/** Stand-in for the gateway's checkout page. Development only (PAYMENT_DRIVER=fake). */
export default async function FakeCheckoutPage({ params, searchParams }: PageProps<"/dev/checkout/[paymentId]">) {
  const gateway = getFakeGateway();
  if (!gateway) notFound();
  const { paymentId } = await params;
  const { amount, method, sig } = await searchParams;
  const { t, locale } = await getI18n();

  const genuine =
    typeof amount === "string" && typeof method === "string" && gateway.checkCheckoutLink(paymentId, amount, method, typeof sig === "string" ? sig : undefined);

  const form = (status: "paid" | "failed", label: string, variant: "primary" | "secondary") => (
    <form action="/api/payments/fake/callback" method="post">
      {Object.entries(gateway.callbackFields(paymentId, Number(amount), status)).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={buttonClasses({ variant, size: "lg", block: true })}>
        {label}
      </button>
    </form>
  );

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-lg bg-surface p-6 shadow-card ring-1 ring-line">
        <p className="text-xs font-semibold uppercase tracking-wide text-warning">{t("wizard.devCheckout.badge")}</p>
        <h1 className="mt-1 text-h3 font-bold text-ink">{t("wizard.devCheckout.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("wizard.devCheckout.body")}</p>
        {genuine ? (
          <>
            <dl className="my-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("wizard.devCheckout.amount")}</dt>
                <dd className="text-lg font-bold text-ink">{formatTaka(Number(amount), locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("wizard.devCheckout.method")}</dt>
                <dd className="font-semibold text-ink">{t(`wizard.c11.${method === "card" ? "card" : "bkash"}`)}</dd>
              </div>
            </dl>
            <div className="space-y-3">
              {form("paid", t("wizard.devCheckout.succeed"), "primary")}
              {form("failed", t("wizard.devCheckout.fail"), "secondary")}
            </div>
          </>
        ) : (
          <div className="mt-6">
            <Alert tone="danger">{t("wizard.devCheckout.invalid")}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
