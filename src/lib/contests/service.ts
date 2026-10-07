import { randomBytes } from "node:crypto";
import type { PaymentGateway, PaymentMethod } from "@/lib/payments/gateway";
import { cleanBrief, validateBrief, type Brief, type Order } from "./brief";
import { calculatePrice, validateOrder, type PricingConfig } from "./pricing";

export type ContestStatus =
  | "draft"
  | "pending_payment"
  | "open"
  | "judging"
  | "winner_selected"
  | "handover"
  | "completed"
  | "no_result"
  | "cancelled";

export type Amounts = { prize: number; serviceFee: number; upgrades: number; total: number };

export type ContestRecord = {
  id: string;
  clientId: string;
  slug: string;
  status: ContestStatus;
  brief: Brief;
  order: Order;
  amounts: Amounts;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
};

export type PaymentRecord = {
  id: string;
  contestId: string;
  clientId: string;
  purpose: "contest" | "extension";
  gateway: string;
  method: PaymentMethod;
  amount: number;
  status: "initiated" | "paid" | "failed";
  gatewayTxnId: string | null;
  paidAt: Date | null;
};

export type DraftData = { brief: Brief; order: Order; amounts: Amounts };

/**
 * Persistence for contests and payments. confirmPayment and failPayment must
 * each run in a single transaction, be idempotent, and enforce the rules in
 * the confirm_contest_payment / fail_contest_payment SQL functions.
 */
export interface ContestRepository {
  findContest(id: string): Promise<ContestRecord | null>;
  insertDraft(clientId: string, slug: string, data: DraftData): Promise<ContestRecord>;
  updateDraft(id: string, data: DraftData): Promise<ContestRecord>;
  setPendingPayment(id: string): Promise<void>;
  listByClient(clientId: string): Promise<ContestRecord[]>;
  createPayment(p: Omit<PaymentRecord, "id" | "status" | "gatewayTxnId" | "paidAt">): Promise<PaymentRecord>;
  findPayment(id: string): Promise<PaymentRecord | null>;
  confirmPayment(paymentId: string, amount: number, txnId: string | null, raw: Record<string, string>): Promise<ContestRecord>;
  failPayment(paymentId: string, raw: Record<string, string>): Promise<void>;
}

export class AmountMismatchError extends Error {}

type Fail<E extends string> = { ok: false; error: E };

const EDITABLE: ContestStatus[] = ["draft", "pending_payment"];

export function makeSlug(brandName: string): string {
  const base = brandName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "contest"}-${randomBytes(4).toString("hex").slice(0, 6)}`;
}

/** Owns every contest change made by the wizard and the payment flow. */
export class ContestService {
  constructor(
    private readonly deps: {
      repo: ContestRepository;
      pricing: () => Promise<PricingConfig>;
      gateway: PaymentGateway;
      slug?: (brandName: string) => string;
    },
  ) {}

  private async prepare(brief: Brief, order: Order): Promise<DraftData | "invalid_brief" | "invalid_order"> {
    const clean = cleanBrief(brief);
    if (Object.keys(validateBrief(clean)).length > 0) return "invalid_brief";
    const cfg = await this.deps.pricing();
    if (validateOrder(order, cfg)) return "invalid_order";
    // Prices are always recomputed here from settings; nothing the browser sends is trusted.
    const price = calculatePrice(order, cfg);
    const cleanOrder: Order = {
      ...order,
      customPrize: order.package === "custom" ? order.customPrize : null,
    };
    return {
      brief: clean,
      order: cleanOrder,
      amounts: { prize: price.prize, serviceFee: price.serviceFee, upgrades: price.upgradesTotal, total: price.total },
    };
  }

  /** Creates or updates the client's server-side draft. */
  async saveDraft(
    clientId: string,
    brief: Brief,
    order: Order,
    contestId?: string | null,
  ): Promise<{ ok: true; contest: ContestRecord } | Fail<"invalid_brief" | "invalid_order" | "not_found" | "not_editable">> {
    const data = await this.prepare(brief, order);
    if (typeof data === "string") return { ok: false, error: data };

    if (!contestId) {
      const slug = (this.deps.slug ?? makeSlug)(data.brief.brandName);
      return { ok: true, contest: await this.deps.repo.insertDraft(clientId, slug, data) };
    }

    const existing = await this.deps.repo.findContest(contestId);
    if (!existing || existing.clientId !== clientId) return { ok: false, error: "not_found" };
    if (!EDITABLE.includes(existing.status)) return { ok: false, error: "not_editable" };
    return { ok: true, contest: await this.deps.repo.updateDraft(contestId, data) };
  }

  /** C-11: records an initiated payment for the current total and returns the gateway checkout URL. */
  async startCheckout(input: {
    clientId: string;
    contestId: string;
    method: PaymentMethod;
    customer: { name: string; mobile: string };
  }): Promise<{ ok: true; payment: PaymentRecord; redirectUrl: string } | Fail<"not_found" | "not_editable" | "invalid_brief" | "invalid_order">> {
    const contest = await this.deps.repo.findContest(input.contestId);
    if (!contest || contest.clientId !== input.clientId) return { ok: false, error: "not_found" };
    if (!EDITABLE.includes(contest.status)) return { ok: false, error: "not_editable" };

    // Re-price with the current settings before charging.
    const data = await this.prepare(contest.brief, contest.order);
    if (typeof data === "string") return { ok: false, error: data };
    const fresh = await this.deps.repo.updateDraft(contest.id, data);

    const payment = await this.deps.repo.createPayment({
      contestId: fresh.id,
      clientId: input.clientId,
      purpose: "contest",
      gateway: this.deps.gateway.name,
      method: input.method,
      amount: fresh.amounts.total,
    });
    await this.deps.repo.setPendingPayment(fresh.id);

    const { redirectUrl } = await this.deps.gateway.createCheckout({
      paymentId: payment.id,
      amount: payment.amount,
      method: input.method,
      description: fresh.brief.brandName,
      customer: input.customer,
    });
    return { ok: true, payment, redirectUrl };
  }

  /**
   * Handles the gateway callback. Verifies it with the gateway first; a
   * contest only opens when the gateway confirms the full amount.
   */
  async handleCallback(
    params: Record<string, string>,
  ): Promise<{ ok: true; paymentId: string; status: "paid" | "failed" } | Fail<"unverified" | "not_found" | "amount_mismatch">> {
    const verified = await this.deps.gateway.verifyCallback(params);
    if (!verified) return { ok: false, error: "unverified" };

    const payment = await this.deps.repo.findPayment(verified.paymentId);
    if (!payment || payment.gateway !== this.deps.gateway.name) return { ok: false, error: "not_found" };

    if (verified.status === "failed") {
      await this.deps.repo.failPayment(payment.id, verified.raw);
      return { ok: true, paymentId: payment.id, status: "failed" };
    }

    try {
      await this.deps.repo.confirmPayment(payment.id, verified.amount, verified.txnId, verified.raw);
    } catch (err) {
      if (err instanceof AmountMismatchError) return { ok: false, error: "amount_mismatch" };
      throw err;
    }
    return { ok: true, paymentId: payment.id, status: "paid" };
  }
}
