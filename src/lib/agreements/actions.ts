"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/services";
import type { MessageKey } from "@/lib/i18n/translate";
import { checkAgreement, type AgreementField } from "@/lib/legal/agreement-rules";
import { LEGAL_VERSION } from "@/lib/legal/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type AgreementState = { ok: boolean; errors?: Partial<Record<AgreementField, MessageKey>>; error?: MessageKey; next?: string };

const FIELD_ERRORS: Record<AgreementField, MessageKey> = {
  fullName: "agreement.errors.fullName",
  mobile: "agreement.errors.mobile",
  address: "agreement.errors.address",
  idType: "agreement.errors.idType",
  idNumber: "agreement.errors.idNumber",
  signature: "agreement.errors.signature",
  agreed: "agreement.errors.agreed",
};

/** Only same-site paths, so the form can't be used to send someone elsewhere. */
const safeNext = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : "/contests");

/** D-12: a designer signs the originality agreement once (BLUEPRINT §9.6). */
export async function signAgreement(_prev: AgreementState, formData: FormData): Promise<AgreementState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status !== "active") return { ok: false, error: "auth.errors.generic" };

  const checked = checkAgreement({
    fullName: String(formData.get("fullName") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    address: String(formData.get("address") ?? ""),
    idType: String(formData.get("idType") ?? ""),
    idNumber: String(formData.get("idNumber") ?? ""),
    signature: String(formData.get("signature") ?? ""),
    agreed: formData.get("agreed") === "on",
  });
  if (!checked.ok) {
    const errors: Partial<Record<AgreementField, MessageKey>> = {};
    for (const f of Object.keys(checked.errors) as AgreementField[]) errors[f] = FIELD_ERRORS[f];
    return { ok: false, errors };
  }

  const v = checked.values;
  const h = await headers();
  const { error } = await createAdminClient()
    .from("designer_agreements")
    .insert({
      designer_id: user.id,
      full_name: v.fullName,
      mobile: v.mobile,
      address: v.address,
      id_type: v.idType,
      id_number: v.idNumber,
      signature_name: v.signature,
      version: LEGAL_VERSION,
      signed_ip: await clientIp(),
      user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
    });
  // 23505: already signed (for example in another tab). The signed one stands; carry on.
  if (error && error.code !== "23505") return { ok: false, error: "agreement.errors.generic" };
  return { ok: true, next: safeNext(formData.get("next")) };
}
