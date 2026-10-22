import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty } from "@/components/client/parts";
import { getCurrentUser } from "@/lib/auth/session";
import { contestHref } from "@/lib/client/rules";
import { clientPayments } from "@/lib/client/workspace";
import { formatDate } from "@/lib/dates";
import { refundedPaymentIds } from "@/lib/guarantee/queries";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.pay.metaTitle"), robots: { index: false } };
}

// Premium client workspace › Payments (owner, 2026-10-16): the client's own payments, from the existing payments table.
export default async function ClientPaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fpayments");
  if (user.role !== "client") redirect("/dashboard");
  const [{ t, locale }, list, back] = await Promise.all([getI18n(), clientPayments(user.id), refundedPaymentIds()]);
  // Money-back refunds (owner, 2026-10-21): shown as "Money back" and left out of the total.
  const paid = list.filter((p) => p.status === "paid" && !back.has(p.id));
  return (
    <>
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("cw.menu.payments")}</h1>
          </div>
          <p>{t("cw.pay.lead", { total: formatTaka(paid.reduce((a, p) => a + p.amount, 0), locale) })}</p>
        </div>
      </div>
      <section className="dcard">
        {list.length === 0 ? (
          <Empty title={t("cw.pay.none")} />
        ) : (
          <div className="cdl" data-payments>
            {list.map((p) => (
              <div key={p.id} style={{ alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 15 }}>
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <Link href={contestHref(p.slug, "payment")} style={{ fontWeight: 700, color: "#0F1014" }}>
                    {p.brand}
                  </Link>
                  <span>
                    {t(`cw.pay.purposes.${p.purpose === "contest" ? "contest" : p.purpose === "extension" ? "extension" : "addon"}`)} · {t(`cw.methods.${p.method === "card" ? "card" : "bkash"}`)}
                    {p.txnId ? ` · ${p.txnId}` : ""} · {formatDate(p.at, locale, "short")}
                  </span>
                </span>
                <b style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {formatTaka(p.amount, locale)}
                  {back.has(p.id) ? (
                    <span className="pss win">{t("guarantee.prizeState")}</span>
                  ) : (
                    <span className={`pss ${p.status === "paid" ? "op" : "win"}`}>{t(`cw.pay.status.${p.status === "paid" ? "paid" : p.status === "failed" ? "failed" : "waiting"}`)}</span>
                  )}
                </b>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
