import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/pro/checkout-form";
import { openMethods } from "@/lib/payments/methods";
import { Icon } from "@/components/pro/parts";
import { PageShell } from "@/components/ui/panel";
import "@/components/pro/pro.css";
import "@/components/pro/go-pro.css";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { isProActive, planPrice, priceQuote, PRO_PLANS, proMonthsOf, receiptCode, type ProMonths } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription, getTrial, pendingProPayment } from "@/lib/pro/status";
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
  const [{ t, locale, currency, price: money }, user, { settings: s, ready }] = await Promise.all([getI18n(), getCurrentUser(), getProSettings()]);
  if (!user) redirect("/login?as=designer&next=%2Fpro%2Fcheckout");
  if (user.role !== "designer") redirect("/pro");
  const sub = await getSubscription(user.id);
  const pro = isProActive(sub);
  const status = sp.status === "success" || sp.status === "failed" ? sp.status : null;
  // Already paid by bKash and waiting for approval (owner, 2026-10-14): show that payment, never a second checkout.
  const pending = !pro && !status ? await pendingProPayment(user.id) : null;
  if (pending) redirect(`/pay/pro/${pending}`);
  const paymentId = typeof sp.payment === "string" && UUID.test(sp.payment) ? sp.payment : null;
  // Someone who had the free Pro Trial is not a first-time buyer (owner, 2026-10-14).
  // 1, 6 or 12 months (owner, 2026-11-02): chosen with ?plan=, monthly by default.
  const months = proMonthsOf(sp.plan);
  const quote = priceQuote(s, { firstTime: !sub && !(await getTrial(user.id)), months });
  const price = money(planPrice(s, months));
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
    { key: "pro.checkout.inc.i9", on: s.features.hidden_entries },
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
          <span>{quote.reason === "trial" ? t("pro.checkout.trialLine", { days: n(quote.trialDays) }) : months === 1 ? t("pro.checkout.line") : t("pro.checkout.lineMonths", { n: n(months) })}</span>
          <b>{quote.reason === "list" ? price : <s>{price}</s>}</b>
        </div>
        {quote.reason === "offer" && (
          <div>
            <span>{t("pro.checkout.offer")}</span>
            <b>{money(quote.amount)}</b>
          </div>
        )}
        <div className="tt">
          <span>{t("pro.checkout.total")}</span>
          <b>{money(quote.amount)}</b>
        </div>
      </div>
      <span className="ck-ren">{months === 1 ? t("pro.checkout.renews") : t("pro.checkout.renewsPlan", { n: n(months) })}</span>
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
            <b>{mine ? money(mine.amount_bdt as number) : t("pro.checkout.trial")}</b>
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
    main = (
      <div className="flex flex-col gap-4">
        <PlanChooser months={months} plans={PRO_PLANS.map((m) => ({ months: m, label: m === 1 ? t("pro.checkout.plans.m1") : t("pro.checkout.plans.mN", { n: n(m) }), price: money(planPrice(s, m)), save: m === 1 ? null : savePercent(s.priceBdt * m, planPrice(s, m)) }))} t={t} n={n} />
        <CheckoutForm key={months} months={months} amountLabel={money(quote.amount)} priceLabel={price} trialDays={quote.reason === "trial" ? quote.trialDays : 0} renew={pro} methods={await openMethods(locale, currency.code)} />
      </div>
    );
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

/** "Save 58%": how much a longer plan saves against paying monthly. */
const savePercent = (monthly: number, plan: number) => (monthly > plan ? Math.round(((monthly - plan) / monthly) * 100) : null);

/** The three plans (owner, 2026-11-02): links, so the price and summary come from the server. */
function PlanChooser({ months, plans, t, n }: { months: ProMonths; plans: { months: ProMonths; label: string; price: string; save: number | null }[]; t: (k: MessageKey, p?: Record<string, string | number>) => string; n: (v: number) => string }) {
  return (
    <nav aria-label={t("pro.checkout.plans.title")} className="grid grid-cols-3 gap-2">
      {plans.map((p) => (
        <Link
          key={p.months}
          href={p.months === 1 ? "/pro/checkout" : `/pro/checkout?plan=${p.months}`}
          scroll={false}
          aria-current={p.months === months ? "true" : undefined}
          className={`flex flex-col items-center gap-0.5 rounded-[16px] px-2 py-3 text-center ring-1 transition ${p.months === months ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-ink"}`}
        >
          <span className="text-[13.5px] font-semibold">{p.label}</span>
          <strong className="text-[18px] font-bold">{p.price}</strong>
          {p.save ? <span className={`rounded-full px-2 text-[12px] font-bold ${p.months === months ? "bg-white/15" : "bg-[#e7f8ee] text-[#14633c]"}`}>{t("pro.checkout.plans.save", { n: n(p.save) })}</span> : <span className="text-[12px] opacity-70">{t("pro.checkout.plans.monthly")}</span>}
        </Link>
      ))}
    </nav>
  );
}
