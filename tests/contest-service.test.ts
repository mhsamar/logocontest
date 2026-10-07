import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "@/lib/contests/brief";
import type { PricingConfig } from "@/lib/contests/pricing";
import {
  AmountMismatchError,
  ContestService,
  type ContestRecord,
  type ContestRepository,
  type DraftData,
  type PaymentRecord,
} from "@/lib/contests/service";
import { FakeGateway } from "@/lib/payments/fake-gateway";
import { validBrief } from "./fixtures";

/** Mirrors the rules of confirm_contest_payment / fail_contest_payment (migration 0004). */
class MemoryRepo implements ContestRepository {
  contests = new Map<string, ContestRecord>();
  payments = new Map<string, PaymentRecord>();
  private seq = 0;
  constructor(private now: () => Date) {}
  private id() {
    return `00000000-0000-4000-8000-${String(++this.seq).padStart(12, "0")}`;
  }
  async findContest(id: string) {
    return structuredClone(this.contests.get(id) ?? null);
  }
  async insertDraft(clientId: string, slug: string, d: DraftData) {
    const c: ContestRecord = { id: this.id(), clientId, slug, status: "draft", ...d, startsAt: null, endsAt: null, createdAt: this.now() };
    this.contests.set(c.id, c);
    return structuredClone(c);
  }
  async updateDraft(id: string, d: DraftData) {
    const c = this.contests.get(id)!;
    if (c.status !== "draft" && c.status !== "pending_payment") throw new Error("not editable");
    Object.assign(c, d, { status: "draft" });
    return structuredClone(c);
  }
  async setPendingPayment(id: string) {
    const c = this.contests.get(id)!;
    if (c.status === "draft") c.status = "pending_payment";
  }
  async listByClient(clientId: string) {
    return [...this.contests.values()].filter((c) => c.clientId === clientId);
  }
  async createPayment(p: Parameters<ContestRepository["createPayment"]>[0]) {
    const pay: PaymentRecord = { ...p, id: this.id(), status: "initiated", gatewayTxnId: null, paidAt: null };
    this.payments.set(pay.id, pay);
    return structuredClone(pay);
  }
  async findPayment(id: string) {
    return structuredClone(this.payments.get(id) ?? null);
  }
  async confirmPayment(paymentId: string, amount: number, txnId: string | null) {
    const p = this.payments.get(paymentId)!;
    const c = this.contests.get(p.contestId)!;
    if (p.status === "paid") return structuredClone(c);
    if (amount !== p.amount || p.amount !== c.amounts.total) throw new AmountMismatchError("amount mismatch");
    if (c.status !== "draft" && c.status !== "pending_payment") throw new Error("not waiting");
    Object.assign(p, { status: "paid", paidAt: this.now(), gatewayTxnId: txnId });
    Object.assign(c, { status: "open", startsAt: this.now(), endsAt: new Date(this.now().getTime() + c.order.durationDays * 86_400_000) });
    return structuredClone(c);
  }
  async failPayment(paymentId: string) {
    const p = this.payments.get(paymentId)!;
    if (p.status !== "initiated") return;
    p.status = "failed";
    const c = this.contests.get(p.contestId)!;
    if (c.status === "pending_payment") c.status = "draft";
  }
}

const cfg: PricingConfig = {
  serviceFeePercent: 20,
  packagePrizes: { economy: 3000, standard: 5000, premium: 10000 },
  customMin: 3000,
  customStep: 500,
  upgradePrices: { blind: 1000, private: 1000, promoted: 1000 },
  durationOptions: [5, 7, 10],
  defaultDuration: 7,
};

const order = (over: Partial<Order> = {}): Order => ({
  package: "standard",
  customPrize: null,
  durationDays: 7,
  upgrades: { blind: false, private: false, promoted: false },
  ...over,
});

const CLIENT = "client-1";
const customer = { name: "Rahim Uddin", mobile: "+8801712345678" };

describe("ContestService", () => {
  let now: Date;
  let repo: MemoryRepo;
  let gateway: FakeGateway;
  let service: ContestService;
  let pricing: PricingConfig;

  beforeEach(() => {
    now = new Date("2026-10-07T10:00:00Z");
    repo = new MemoryRepo(() => now);
    gateway = new FakeGateway("test-secret");
    pricing = { ...cfg };
    service = new ContestService({ repo, gateway, pricing: async () => pricing, slug: () => "rahim-tea-abc123" });
  });

  const draft = async (o = order()) => {
    const r = await service.saveDraft(CLIENT, validBrief(), o);
    if (!r.ok) throw new Error(r.error);
    return r.contest;
  };
  const checkout = async (contestId: string) => {
    const r = await service.startCheckout({ clientId: CLIENT, contestId, method: "bkash", customer });
    if (!r.ok) throw new Error(r.error);
    return r;
  };
  const callback = (paymentId: string, amount: number, status: "paid" | "failed") =>
    service.handleCallback(gateway.callbackFields(paymentId, amount, status));

  describe("drafts", () => {
    it("saves a draft with server-computed amounts", async () => {
      const c = await draft(order({ package: "premium", upgrades: { blind: true, private: false, promoted: false } }));
      expect(c).toMatchObject({ status: "draft", clientId: CLIENT, slug: "rahim-tea-abc123" });
      expect(c.amounts).toEqual({ prize: 10000, serviceFee: 2000, upgrades: 1000, total: 13000 });
    });

    it("updates the same draft instead of creating another", async () => {
      const c = await draft();
      const r = await service.saveDraft(CLIENT, { ...validBrief(), brandName: "Rahim Tea" }, order({ package: "economy" }), c.id);
      expect(r.ok && r.contest.id).toBe(c.id);
      expect(repo.contests.size).toBe(1);
      expect(repo.contests.get(c.id)!.amounts.total).toBe(3600);
    });

    it("refuses another client's draft", async () => {
      const c = await draft();
      expect(await service.saveDraft("someone-else", validBrief(), order(), c.id)).toEqual({ ok: false, error: "not_found" });
    });

    it("refuses incomplete briefs and invalid custom amounts", async () => {
      expect(await service.saveDraft(CLIENT, { ...validBrief(), likes: "" }, order())).toEqual({ ok: false, error: "invalid_brief" });
      expect(await service.saveDraft(CLIENT, validBrief(), order({ package: "custom", customPrize: 3200 }))).toEqual({
        ok: false,
        error: "invalid_order",
      });
    });

    it("cannot edit a contest that is already live", async () => {
      const c = await draft();
      const { payment } = await checkout(c.id);
      await callback(payment.id, payment.amount, "paid");
      expect(await service.saveDraft(CLIENT, validBrief(), order(), c.id)).toEqual({ ok: false, error: "not_editable" });
    });
  });

  describe("payment", () => {
    it("charges the current total and marks the contest pending", async () => {
      const c = await draft();
      const { payment, redirectUrl } = await checkout(c.id);
      expect(payment).toMatchObject({ amount: 6000, status: "initiated", gateway: "fake", purpose: "contest" });
      expect(repo.contests.get(c.id)!.status).toBe("pending_payment");
      expect(redirectUrl).toMatch(new RegExp(`^/dev/checkout/${payment.id}\\?`));
    });

    it("re-prices at checkout if settings changed since the draft", async () => {
      const c = await draft();
      pricing = { ...pricing, packagePrizes: { ...pricing.packagePrizes, standard: 6000 } };
      const { payment } = await checkout(c.id);
      expect(payment.amount).toBe(7200);
    });

    it("success: the contest opens with start and end dates", async () => {
      const c = await draft(order({ durationDays: 10 }));
      const { payment } = await checkout(c.id);
      expect(await callback(payment.id, 6000, "paid")).toEqual({ ok: true, paymentId: payment.id, status: "paid" });
      const live = repo.contests.get(c.id)!;
      expect(live.status).toBe("open");
      expect(live.startsAt).toEqual(now);
      expect(live.endsAt).toEqual(new Date("2026-10-17T10:00:00Z"));
      expect(repo.payments.get(payment.id)!.status).toBe("paid");
    });

    it("failure: the payment fails and the contest stays a draft", async () => {
      const c = await draft();
      const { payment } = await checkout(c.id);
      expect(await callback(payment.id, 6000, "failed")).toMatchObject({ ok: true, status: "failed" });
      expect(repo.contests.get(c.id)!.status).toBe("draft");
      expect(repo.payments.get(payment.id)!.status).toBe("failed");
    });

    it("a failed payment can be retried with a new payment", async () => {
      const c = await draft();
      const first = await checkout(c.id);
      await callback(first.payment.id, 6000, "failed");
      const second = await checkout(c.id);
      expect(second.payment.id).not.toBe(first.payment.id);
      await callback(second.payment.id, 6000, "paid");
      expect(repo.contests.get(c.id)!.status).toBe("open");
    });

    it("a duplicate success callback changes nothing", async () => {
      const c = await draft();
      const { payment } = await checkout(c.id);
      await callback(payment.id, 6000, "paid");
      const endsAt = repo.contests.get(c.id)!.endsAt;
      now = new Date("2026-10-08T10:00:00Z");
      expect(await callback(payment.id, 6000, "paid")).toMatchObject({ ok: true, status: "paid" });
      expect(repo.contests.get(c.id)!.endsAt).toEqual(endsAt);
    });

    it("a late failure callback after success does not undo the payment", async () => {
      const c = await draft();
      const { payment } = await checkout(c.id);
      await callback(payment.id, 6000, "paid");
      await callback(payment.id, 6000, "failed");
      expect(repo.payments.get(payment.id)!.status).toBe("paid");
      expect(repo.contests.get(c.id)!.status).toBe("open");
    });

    it("never opens a contest for a tampered or wrong amount", async () => {
      const c = await draft();
      const { payment } = await checkout(c.id);
      // Signed by the gateway but for less money than the contest costs
      expect(await callback(payment.id, 100, "paid")).toEqual({ ok: false, error: "amount_mismatch" });
      // Amount edited after signing
      const fields = gateway.callbackFields(payment.id, 6000, "paid");
      expect(await service.handleCallback({ ...fields, amount: "100" })).toEqual({ ok: false, error: "unverified" });
      // Status flipped after signing
      const failed = gateway.callbackFields(payment.id, 6000, "failed");
      expect(await service.handleCallback({ ...failed, status: "paid" })).toEqual({ ok: false, error: "unverified" });
      expect(repo.contests.get(c.id)!.status).toBe("pending_payment");
    });

    it("never opens a contest that changed after checkout started", async () => {
      const c = await draft();
      const { payment } = await checkout(c.id);
      await service.saveDraft(CLIENT, validBrief(), order({ package: "premium" }), c.id);
      expect(await callback(payment.id, 6000, "paid")).toEqual({ ok: false, error: "amount_mismatch" });
      expect(repo.contests.get(c.id)!.status).toBe("draft");
    });

    it("ignores callbacks for unknown payments", async () => {
      expect(await callback("00000000-0000-4000-8000-999999999999", 6000, "paid")).toEqual({ ok: false, error: "not_found" });
    });

    it("refuses checkout for someone else's contest", async () => {
      const c = await draft();
      expect(await service.startCheckout({ clientId: "intruder", contestId: c.id, method: "card", customer })).toEqual({
        ok: false,
        error: "not_found",
      });
    });
  });
});
