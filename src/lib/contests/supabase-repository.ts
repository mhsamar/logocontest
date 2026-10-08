import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyBrief, noUpgrades, type Brief, type Order } from "./brief";
import {
  AmountMismatchError,
  type ContestRecord,
  type ContestRepository,
  type DraftData,
  type PaymentRecord,
} from "./service";

type ContestRow = {
  id: string;
  client_id: string;
  slug: string;
  status: ContestRecord["status"];
  brand_name: string;
  logo_text: string | null;
  slogan: string | null;
  business_type: string;
  business_description: string;
  website_url: string | null;
  styles: Brief["styles"];
  style_sliders: Brief["sliders"];
  colors: string[];
  let_designers_choose_colors: boolean;
  used_on: Brief["usedOn"];
  likes_text: string;
  dislikes_text: string | null;
  short_name: string | null;
  target_audience: string | null;
  deliverables: Brief["deliverables"] | null;
  requirements: Brief["requirements"] | null;
  requirements_note: string | null;
  package: Order["package"];
  prize_amount: number;
  service_fee_amount: number;
  upgrades_amount: number;
  total_amount: number;
  duration_days: number;
  is_blind: boolean;
  is_private: boolean;
  is_promoted: boolean;
  is_highlighted: boolean;
  is_urgent: boolean;
  is_nda: boolean;
  logo_scan: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  contest_id: string;
  client_id: string;
  purpose: PaymentRecord["purpose"];
  gateway: string;
  method: PaymentRecord["method"];
  amount: number;
  status: PaymentRecord["status"];
  gateway_txn_id: string | null;
  paid_at: string | null;
};

const date = (v: string | null) => (v ? new Date(v) : null);

export function toContestRecord(r: ContestRow): ContestRecord {
  const base = emptyBrief();
  return {
    id: r.id,
    clientId: r.client_id,
    slug: r.slug,
    status: r.status,
    brief: {
      brandName: r.brand_name,
      shortName: r.short_name ?? "",
      logoText: r.logo_text ?? "",
      slogan: r.slogan ?? "",
      businessType: r.business_type as Brief["businessType"],
      businessDescription: r.business_description,
      targetAudience: r.target_audience ?? "",
      websiteUrl: r.website_url ?? "",
      noWebsite: !r.website_url,
      styles: r.styles ?? [],
      sliders: { ...base.sliders, ...(r.style_sliders ?? {}) },
      colors: r.colors ?? [],
      letDesignersChoose: r.let_designers_choose_colors,
      usedOn: r.used_on ?? [],
      deliverables: r.deliverables ?? [],
      likes: r.likes_text,
      dislikes: r.dislikes_text ?? "",
      requirements: r.requirements ?? [],
      requirementsNote: r.requirements_note ?? "",
    },
    order: {
      package: r.package,
      customPrize: r.package === "custom" ? r.prize_amount : null,
      durationDays: r.duration_days,
      upgrades: {
        ...noUpgrades(),
        blind: r.is_blind,
        private: r.is_private,
        promoted: r.is_promoted,
        logo_scan: Boolean(r.logo_scan),
        highlight: Boolean(r.is_highlighted),
        urgent: Boolean(r.is_urgent),
        nda: Boolean(r.is_nda),
      },
    },
    amounts: { prize: r.prize_amount, serviceFee: r.service_fee_amount, upgrades: r.upgrades_amount, total: r.total_amount },
    startsAt: date(r.starts_at),
    endsAt: date(r.ends_at),
    createdAt: new Date(r.created_at),
  };
}

function toPaymentRecord(r: PaymentRow): PaymentRecord {
  return {
    id: r.id,
    contestId: r.contest_id,
    clientId: r.client_id,
    purpose: r.purpose,
    gateway: r.gateway,
    method: r.method,
    amount: r.amount,
    status: r.status,
    gatewayTxnId: r.gateway_txn_id,
    paidAt: date(r.paid_at),
  };
}

/** The brief details added on 2026-10-08 (migration 0016); shared with the brief editor. */
export function briefDetailColumns(brief: Brief) {
  return {
    short_name: brief.shortName || null,
    target_audience: brief.targetAudience || null,
    deliverables: brief.deliverables,
    requirements: brief.requirements,
    requirements_note: brief.requirementsNote || null,
  };
}

function columns({ brief, order, amounts }: DraftData) {
  return {
    brand_name: brief.brandName,
    logo_text: brief.logoText || null,
    slogan: brief.slogan || null,
    business_type: brief.businessType,
    business_description: brief.businessDescription,
    website_url: brief.websiteUrl || null,
    styles: brief.styles,
    style_sliders: brief.sliders,
    colors: brief.colors,
    let_designers_choose_colors: brief.letDesignersChoose,
    used_on: brief.usedOn,
    likes_text: brief.likes,
    dislikes_text: brief.dislikes || null,
    ...briefDetailColumns(brief),
    package: order.package,
    prize_amount: amounts.prize,
    service_fee_amount: amounts.serviceFee,
    upgrades_amount: amounts.upgrades,
    total_amount: amounts.total,
    duration_days: order.durationDays,
    // NDA includes Private (owner, 2026-10-08).
    is_blind: order.upgrades.blind,
    is_private: order.upgrades.private || order.upgrades.nda,
    is_promoted: order.upgrades.promoted,
    logo_scan: order.upgrades.logo_scan,
    is_highlighted: order.upgrades.highlight,
    is_urgent: order.upgrades.urgent,
    is_nda: order.upgrades.nda,
  };
}

function check<T>({ data, error }: { data: T; error: { message: string; code?: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export class SupabaseContestRepository implements ContestRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findContest(id: string) {
    const row = check(await this.db.from("contests").select("*").eq("id", id).maybeSingle<ContestRow>());
    return row ? toContestRecord(row) : null;
  }

  async insertDraft(clientId: string, slug: string, data: DraftData) {
    const row = check(
      await this.db
        .from("contests")
        .insert({ client_id: clientId, slug, status: "draft", ...columns(data) })
        .select("*")
        .single<ContestRow>(),
    );
    return toContestRecord(row!);
  }

  async updateDraft(id: string, data: DraftData) {
    const row = check(
      await this.db
        .from("contests")
        .update({ status: "draft", ...columns(data) })
        .eq("id", id)
        .in("status", ["draft", "pending_payment"])
        .select("*")
        .single<ContestRow>(),
    );
    return toContestRecord(row!);
  }

  async setPendingPayment(id: string) {
    check(await this.db.from("contests").update({ status: "pending_payment" }).eq("id", id).eq("status", "draft"));
  }

  async listByClient(clientId: string) {
    const rows = check(
      await this.db
        .from("contests")
        .select("*")
        .eq("client_id", clientId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(20)
        .returns<ContestRow[]>(),
    );
    return (rows ?? []).map((r) => toContestRecord(r));
  }

  async createPayment(p: Parameters<ContestRepository["createPayment"]>[0]) {
    const row = check(
      await this.db
        .from("payments")
        .insert({
          contest_id: p.contestId,
          client_id: p.clientId,
          purpose: p.purpose,
          gateway: p.gateway,
          method: p.method,
          amount: p.amount,
        })
        .select("*")
        .single<PaymentRow>(),
    );
    return toPaymentRecord(row!);
  }

  async findPayment(id: string) {
    const row = check(await this.db.from("payments").select("*").eq("id", id).maybeSingle<PaymentRow>());
    return row ? toPaymentRecord(row) : null;
  }

  async confirmPayment(paymentId: string, amount: number, txnId: string | null, raw: Record<string, string>) {
    const { data, error } = await this.db.rpc("confirm_contest_payment", {
      p_payment_id: paymentId,
      p_amount: amount,
      p_gateway_txn_id: txnId,
      p_raw: raw,
    });
    if (error) {
      if (/amount mismatch/i.test(error.message)) throw new AmountMismatchError(error.message);
      throw new Error(error.message);
    }
    return toContestRecord(data as ContestRow);
  }

  async failPayment(paymentId: string, raw: Record<string, string>) {
    check(await this.db.rpc("fail_contest_payment", { p_payment_id: paymentId, p_raw: raw }));
  }
}
