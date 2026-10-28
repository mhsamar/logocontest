import Link from "@/components/ui/link";
import { ClaimGuarantee } from "@/components/guarantee/claim-guarantee";
import { formatDate } from "@/lib/dates";
import type { ContestGuarantee } from "@/lib/guarantee/queries";
import { refundAmountText, type RouteAmount } from "@/lib/guarantee/rules";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { showMobile } from "@/lib/payments/manual-rules";

/**
 * The money-back guarantee on the client's contest page (owner, 2026-10-21; C-25): a line at the top when the client
 * can claim or has claimed, and a card on the Payment tab with the details.
 */

/** `judgingEndsAt`: until when the client can still pick a winner (null when they can't). */
type Props = { contestId: string; g: ContestGuarantee; judgingEndsAt: Date | null };

async function texts({ g, judgingEndsAt }: Props) {
  const { t, locale } = await getI18n();
  const num = (n: number) => formatNumber(n, locale);
  // Card refunds in the dollars Stripe charged, the rest in taka ("৳6,250 + $8.20").
  const money = (routes: RouteAmount[], taka: number) => refundAmountText(routes, locale, taka);
  const day = (d: Date) => formatDate(d, locale, "long");
  // Deadlines close at a clock time, so they show it.
  const until = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const claim = g.claim;
  const canPick = Boolean(judgingEndsAt && judgingEndsAt > new Date());
  // One sentence per line: a reason the team typed without a full stop must not run into the next sentence.
  const status: string[] = !claim
    ? []
    : claim.status === "pending"
      ? [t(claim.late ? "guarantee.status.pendingLate" : "guarantee.status.pending", { date: day(claim.createdAt) })]
      : claim.status === "approved"
        ? [t("guarantee.status.approved", { amount: money(claim.routes, claim.amount) })]
        : claim.status === "refunded"
          ? [t("guarantee.status.refunded", { amount: money(claim.routes, claim.amount), date: day(claim.refundedAt ?? claim.decidedAt ?? claim.createdAt), ref: claim.refundRef ?? "—" })]
          : [t("guarantee.status.rejected", { reason: claim.reply ?? "" }), ...(canPick ? [t("guarantee.status.rejectedPick", { date: until(judgingEndsAt!) })] : [])];
  // Where each part of the money goes back (once per kind; a bKash part without a number: the team calls).
  const kinds = [...new Set((claim?.routes ?? []).map((r) => r.kind))];
  const where =
    claim && claim.status !== "rejected"
      ? kinds
          .map((k) => (k === "bkash" ? (claim.refundTo ? t("guarantee.status.to", { number: showMobile(claim.refundTo) }) : t("guarantee.status.toBkashCall")) : k === "stripe" ? t("guarantee.status.toCard") : k === "other" ? t("guarantee.status.toGateway") : null))
          .filter((x): x is string => Boolean(x))
      : [];
  return { t, num, money, until, status, where, canPick };
}

/** "2 designers", "Only 1 designer" or "No designs": the line that says the client can claim. */
const availableKey = (s: { late: boolean; designers: number }) =>
  s.late ? "guarantee.card.availableLate" : s.designers === 0 ? "guarantee.card.availableNone" : s.designers === 1 ? "guarantee.card.availableOne" : "guarantee.card.available";

function claimButton(contestId: string, g: ContestGuarantee, label: string, amount: string, className: string) {
  if (g.state.kind !== "available" && g.state.kind !== "check") return null;
  return (
    <ClaimGuarantee
      contestId={contestId}
      check={g.state.kind === "check"}
      designers={g.state.designers}
      min={g.state.min}
      amount={amount}
      card={g.routes.some((r) => r.kind === "stripe")}
      gateway={g.routes.some((r) => r.kind === "other")}
      late={g.state.late}
      needsNumber={g.needsNumber}
      suggestedNumber={g.suggestedNumber}
      label={label}
      className={className}
    />
  );
}

/** At the top of the page: "claim your money back by …", or where the claim stands. */
export async function GuaranteeBanner(props: Props) {
  const { g, contestId } = props;
  if (g.state.kind !== "available" && g.state.kind !== "claimed") return null;
  const { t, num, money, until, status, where, canPick } = await texts(props);
  if (g.state.kind === "claimed") {
    // A claim that wasn't approved stays at the top only while the client can still pick a winner.
    if (g.state.status === "rejected" && !canPick) return null;
    const tone = g.state.status === "rejected" ? "info" : "ok";
    return (
      <div className={`calert ${tone}`} data-guarantee-status={g.state.status}>
        {status.map((line) => (
          <p key={line} className="m-0">
            {line}
          </p>
        ))}
        {where.length > 0 && <p className="m-0">{where.join(" · ")}</p>}
      </div>
    );
  }
  const s = g.state;
  return (
    <div className="calert info flex flex-wrap items-center justify-between gap-3" data-guarantee-banner>
      <span>{t(availableKey(s), { count: num(s.designers), n: num(s.min), date: s.until ? until(s.until) : "" })}</span>
      {claimButton(contestId, g, t("guarantee.card.claim"), money(g.routes, g.amount), "dbtn sm")}
    </div>
  );
}

/** The Payment tab: the promise, the claim button, or the claim's details. */
export async function GuaranteeCard(props: Props) {
  const { g, contestId } = props;
  if (g.state.kind === "none") return null;
  const { t, num, money, until, status, where } = await texts(props);
  const s = g.state;
  return (
    <section className="dcard" id="guarantee" style={{ marginTop: 24, scrollMarginTop: 24 }} data-guarantee={s.kind}>
      <div className="dch">
        <h2>{t(s.kind === "claimed" ? "guarantee.status.title" : "guarantee.card.title")}</h2>
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed">
        {s.kind === "covered" && <p className="m-0">{t("guarantee.card.covered", { n: num(s.min) })}</p>}
        {(s.kind === "available" || s.kind === "check") && (
          <>
            <p className="m-0">
              {s.kind === "check"
                ? t("guarantee.card.check", { count: num(s.designers), date: s.until ? until(s.until) : "" })
                : t(availableKey(s), { count: num(s.designers), n: num(s.min), date: s.until ? until(s.until) : "" })}
            </p>
            <p className="dmut m-0">{t("guarantee.card.counted")}</p>
            {g.held > 0 && <p className="dmut m-0">{g.held === 1 ? t("guarantee.card.heldOne") : t("guarantee.card.held", { count: num(g.held) })}</p>}
          </>
        )}
        {s.kind === "claimed" && (
          <>
            {status.map((line) => (
              <p key={line} className="m-0">
                {line}
              </p>
            ))}
            {where.length > 0 && <p className="dmut m-0">{where.join(" · ")}</p>}
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {claimButton(contestId, g, t(s.kind === "check" ? "guarantee.card.askCheck" : "guarantee.card.claim"), money(g.routes, g.amount), s.kind === "check" ? "dout sm" : "dbtn sm")}
          <Link href="/legal/payment-refund#guarantee" target="_blank" className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t("guarantee.card.how")}
          </Link>
        </div>
      </div>
    </section>
  );
}
