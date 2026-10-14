import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/pro/checkout-form";
import { Icon } from "@/components/pro/parts";
import { PageShell } from "@/components/ui/panel";
import "@/components/pro/pro.css";
import "@/components/pro/go-pro.css";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { isProActive, priceQuote, receiptCode } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription, getTrial } from "@/lib/pro/status";
import { logFunnel } from "@/lib/pro/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.checkout.metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f-]{36}$/i;

// Pro checkout (owner, 2026-10-13; Design/pro/pro-checkout.html): Checkout → Paying → You are Pro / Payment failed.
// The gateway brings the designer back here with ?status=success|failed&payment=<id>.
export default async function ProCheckoutPage({ searchParams }: PageProps<"/pro/checkout">) {
  const sp = await searchParams;
  const [{ t, locale }, user, { settings: s, ready }] = await Promise.all([getI18n(), getCurrentUser(), getProSettings()]);
  if (!user) redirect("/login?as=designer&next=%2Fpro%2Fcheckout");
  if (user.role !== "designer") redirect("/pro");
  const sub = await getSubscription(user.id);
  const pro = isProActive(sub);
  const status = sp.status === "success" || sp.status === "failed" ? sp.status : null;
  const paymentId = typeof sp.payment === "string" && UUID.test(sp.payment) ? sp.payment : null;
  // Someone who had the free Pro Trial is not a first-time buyer (owner, 2026-10-14).
  const quote = priceQuote(s, { firstTime: !sub && !(await getTrial(user.id)) });
  const price = formatTaka(s.priceBdt, locale);
  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v);
  const features: { key: MessageKey; on: boolean }[] = [
    { key: "pro.checkout.inc.i1", on: true },
    { key: "pro.checkout.inc.i2", on: s.features.highlighted_entries },
    { key: "pro.checkout.inc.i3", on: s.features.client_chat },
    { key: "pro.checkout.inc.i4", on: s.features.early_access },
    { key: "pro.checkout.inc.i5", on: true },
    { key: "pro.checkout.inc.i6", on: s.features.insights },
    { key: "pro.checkout.inc.i7", on: s.features.priority_support },
    { key: "pro.checkout.inc.i8", on: true },
  ];

  const summary = (
    <aside className="ck-sum">
      <span className="ck-sk">
        <Icon name="crown" size={14} />
        {t("pro.checkout.summaryKicker")}
      </span>
      <h2>{t("pro.checkout.summaryTitle")}</h2>
      <p>{t("pro.checkout.summaryLead")}</p>
      <ul className="ck-inc">
        {features
          .filter((f) => f.on)
          .map((f) => (
            <li key={f.key}>
              <i>
                <Icon name="check" size={16} strokeWidth={2.8} />
              </i>
              {t(f.key, { n: s.proLogoChecks })}
            </li>
          ))}
      </ul>
      <div className="ck-tot">
        <div>
          <span>{quote.reason === "trial" ? t("pro.checkout.trialLine", { days: n(quote.trialDays) }) : t("pro.checkout.line")}</span>
          <b>{quote.reason === "list" ? price : <s>{price}</s>}</b>
        </div>
        {quote.reason === "offer" && (
          <div>
            <span>{t("pro.checkout.offer")}</span>
            <b>{formatTaka(quote.amount, locale)}</b>
          </div>
        )}
        <div className="tt">
          <span>{t("pro.checkout.total")}</span>
          <b>{formatTaka(quote.amount, locale)}</b>
        </div>
      </div>
      <span className="ck-ren">{t("pro.checkout.renews")}</span>
      <span className="ck-ren">{t("pro.checkout.renewsReminder")}</span>
    </aside>
  );

  let main: React.ReactNode;
  if (status === "success") {
    const { data: pay } = paymentId ? await createAdminClient().from("pro_payments").select("amount_bdt, receipt_no, status, designer_id").eq("id", paymentId).maybeSingle() : { data: null };
    const mine = pay && pay.designer_id === user.id ? pay : null;
    main = (
      <section className="ck-pay center">
        <div className="ck-crown">
          <Icon name="crown" size={46} />
        </div>
        <h1>{t("pro.checkout.successTitle")}</h1>
        <p className="ck-ps">{t("pro.checkout.successLead")}</p>
        <div className="ck-rcpt">
          <div>
            <span>{t("pro.checkout.plan")}</span>
            <b>{t("pro.checkout.planValue")}</b>
          </div>
          <div>
            <span>{t("pro.checkout.paid")}</span>
            <b>{mine ? formatTaka(mine.amount_bdt as number, locale) : t("pro.checkout.trial")}</b>
          </div>
          <div>
            <span>{t("pro.checkout.next")}</span>
            <b>{sub ? formatDate(sub.currentPeriodEnd, locale, "long") : "—"}</b>
          </div>
          <div>
            <span>{t("pro.checkout.receipt")}</span>
            <b>{mine ? receiptCode(mine.receipt_no as number) : "—"}</b>
          </div>
        </div>
        <div className="ck-nxt">
          <Link href={user.username ? `/designer/${user.username}` : "/dashboard"} className="ck-nb">
            <i>
              <Icon name="user" />
            </i>
            <span>
              <b>{t("pro.checkout.n1")}</b>
              <em>{t("pro.checkout.n1Sub")}</em>
            </span>
          </Link>
          <Link href="/dashboard/profile#extras" className="ck-nb">
            <i>
              <Icon name="image" />
            </i>
            <span>
              <b>{t("pro.checkout.n2")}</b>
              <em>{t("pro.checkout.n2Sub")}</em>
            </span>
          </Link>
          <Link href="/dashboard/contests" className="ck-nb">
            <i>
              <Icon name="bell" />
            </i>
            <span>
              <b>{t("pro.checkout.n3")}</b>
              <em>{t("pro.checkout.n3Sub")}</em>
            </span>
          </Link>
        </div>
        <Link href="/contests" className="ck-gob">
          {t("pro.checkout.browse")}
          <Icon name="arrow" />
        </Link>
        {mine && <span className="ck-mail">{t("pro.checkout.mail")}</span>}
      </section>
    );
  } else if (status === "failed") {
    main = (
      <section className="ck-pay center">
        <div className="ck-x">
          <Icon name="x" size={38} strokeWidth={2.6} />
        </div>
        <h1>{t("pro.checkout.failedTitle")}</h1>
        <p className="ck-ps">{t("pro.checkout.failedLead")}</p>
        <Link href="/pro/checkout" className="ck-payb narrow">
          {t("pro.checkout.retry")}
        </Link>
        <Link href="/support" className="ck-back">
          {t("pro.checkout.help")}
        </Link>
      </section>
    );
  } else if (!ready || !s.isForSale) {
    main = (
      <section className="ck-pay center">
        <h1>{t("pro.checkout.closedTitle")}</h1>
        <p className="ck-ps">{t("pro.checkout.closedLead")}</p>
        <Link href="/pro" className="pr-out">
          {t("pro.checkout.back")}
        </Link>
      </section>
    );
  } else if (pro && sub!.currentPeriodEnd.getTime() - new Date().getTime() > 7 * 86_400_000) {
    main = (
      <section className="ck-pay center">
        <div className="ck-crown">
          <Icon name="crown" size={46} />
        </div>
        <h1>{t("pro.checkout.alreadyPro", { date: formatDate(sub!.currentPeriodEnd, locale, "long") })}</h1>
        <p className="ck-ps">{t("pro.checkout.renewLater")}</p>
        <Link href="/dashboard" className="pr-btn">
          {t("pro.ws.dashboard")}
        </Link>
      </section>
    );
  } else {
    after(() => logFunnel("checkout_opened", { designerId: user.id, step: pro ? "renewal" : "new" }));
    main = <CheckoutForm amountLabel={formatTaka(quote.amount, locale)} priceLabel={price} trialDays={quote.reason === "trial" ? quote.trialDays : 0} renew={pro} />;
  }

  return (
    <PageShell>
      <div className="pr ck-g">
        {main}
        {summary}
      </div>
    </PageShell>
  );
}
