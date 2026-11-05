import type { Metadata } from "next";
import { AdminHead } from "@/components/admin/page-head";
import { PayFlow } from "@/components/pay-v3/pay-flow";
import { requirePermission } from "@/lib/admin/core";
import { pictureUrl } from "@/lib/content/pictures";
import { getI18n } from "@/lib/i18n/server";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { isManual } from "@/lib/payments/manual-rules";
import { isOpen, methodRows } from "@/lib/payments/methods";
import type { PayV3 } from "@/lib/payments/pay-v3";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.admin.screen.preview"), robots: { index: false } };
}

// Admin › Payments › Methods › "Test on page" (owner, 2026-11-06): the contest payment screen with a sample contest,
// the real bKash number, voice guide and help. Nothing is sent, saved or counted.
export default async function PayPreviewPage() {
  await requirePermission("payments.view");
  const [{ t }, rows, s, cfg] = await Promise.all([
    getI18n(),
    methodRows(),
    getSettings(["pay.voice_on", "pay.voice_path", "pay.voice_cues", "pay.howto_video", "pay.support_hours", "contact.whatsapp", "onboarding.approval_minutes"]),
    getPricingConfig(),
  ]);
  const method = rows.find((r) => r.key === "bkash_personal" && isOpen(r)) ?? rows.find((r) => isManual(r.key) && isOpen(r)) ?? rows.find((r) => isManual(r.key));
  const prize = 5000;
  const fee = Math.round((prize * cfg.serviceFeePercent) / 100);
  const voice = s["pay.voice_on"] && s["pay.voice_path"] ? pictureUrl(s["pay.voice_path"]) : null;
  const data: PayV3 = {
    paymentId: "00000000-0000-0000-0000-000000000000",
    contestId: "preview",
    slug: "",
    brand: "Rakib's Kitchen",
    packageKey: "standard",
    days: 7,
    prize,
    addons: 0,
    fee,
    feePercent: cfg.serviceFeePercent,
    amount: prize + fee,
    number: method?.number ?? "",
    accountName: method?.name ?? null,
    method: method?.key === "bkash_merchant" ? "bkash_merchant" : "bkash_personal",
    reference: "LC1042",
    mobile: "",
    voice: voice ? { url: voice, cues: s["pay.voice_cues"] } : null,
    videoId: s["pay.howto_video"].kind === "youtube" ? s["pay.howto_video"].id : null,
    whatsapp: s["contact.whatsapp"],
    hours: s["pay.support_hours"],
    approvalMinutes: s["onboarding.approval_minutes"],
    state: "open",
    pending: null,
    rejected: null,
  };
  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("pay.admin.screen.preview")} lead={t("pay.admin.screen.previewLead")} crumbs={[{ href: "/admin/payments/methods", label: t("pay.admin.methods.title") }]} />
      <div className="rounded-[24px] bg-[#F6F4F0] px-4 py-6">
        <PayFlow data={data} briefHref="/admin/payments/pay-preview" preview />
      </div>
    </div>
  );
}
