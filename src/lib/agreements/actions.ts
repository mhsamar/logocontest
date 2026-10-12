"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/services";
import type { MessageKey } from "@/lib/i18n/translate";
import { countryName, isCountryCode } from "@/lib/countries";
import { checkAgreement, joinAddress, needsBackPhoto, type AddressField, type AgreementField } from "@/lib/legal/agreement-rules";
import { formFiles, ID_DOCUMENTS_BUCKET, savePhoto } from "@/lib/uploads/photos";
import { currentAgreementVersion } from "@/lib/legal/store";
import { agreementText } from "@/lib/legal";
import { getI18n } from "@/lib/i18n/server";
import { adminIdsWith } from "@/lib/admin/recipients";
import { notify } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export type AgreementState = { ok: boolean; errors?: Partial<Record<AgreementField | AddressField | "idFront" | "idBack", MessageKey>>; error?: MessageKey; next?: string };

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
  if (!user || user.role !== "designer" || user.status === "banned") return { ok: false, error: "auth.errors.generic" };

  // The address comes in parts (owner, 2026-10-10) and is joined into one line.
  const str = (k: string) => String(formData.get(k) ?? "");
  const addr = joinAddress({ house: str("house"), road: str("road"), area: str("area"), postCode: str("postCode"), country: str("country") }, countryName, isCountryCode);
  const checked = checkAgreement({
    fullName: String(formData.get("fullName") ?? ""),
    mobile: String(formData.get("mobile") ?? ""),
    address: addr.ok ? addr.line : "",
    idType: String(formData.get("idType") ?? ""),
    idNumber: String(formData.get("idNumber") ?? ""),
    signature: String(formData.get("signature") ?? ""),
    agreed: formData.get("agreed") === "on",
  });
  // A photo of the ID (owner, 2026-10-10): the front, and the back of a national ID card.
  const front = formFiles(formData, "idFront")[0];
  const back = formFiles(formData, "idBack")[0];
  const idType = String(formData.get("idType") ?? "");
  const photoErrors: AgreementState["errors"] = {};
  if (!front) photoErrors.idFront = "agreement.errors.idFront";
  if (idType === "nid" && !back) photoErrors.idBack = "agreement.errors.idBack";

  if (!checked.ok || !addr.ok || Object.keys(photoErrors).length) {
    const errors: AgreementState["errors"] = { ...photoErrors };
    if (!checked.ok) for (const f of Object.keys(checked.errors) as AgreementField[]) if (f !== "address") errors[f] = FIELD_ERRORS[f];
    if (!addr.ok) for (const f of Object.keys(addr.errors) as AddressField[]) errors[f] = `agreement.errors.${f}` as MessageKey;
    return { ok: false, errors };
  }

  const v = checked.values;
  const stamp = Date.now();
  const frontPath = `${user.id}/front-${stamp}.jpg`;
  const backPath = needsBackPhoto(v.idType) && back ? `${user.id}/back-${stamp}.jpg` : null;
  if (!(await savePhoto(ID_DOCUMENTS_BUCKET, frontPath, front!))) return { ok: false, errors: { idFront: "agreement.errors.idPhotoBad" } };
  if (backPath && !(await savePhoto(ID_DOCUMENTS_BUCKET, backPath, back!))) return { ok: false, errors: { idBack: "agreement.errors.idPhotoBad" } };
  const h = await headers();
  // The exact text this designer read and signed, kept with the signature (owner, 2026-10-12).
  const { locale } = await getI18n();
  const signedText = await agreementText(locale);
  // Upsert: signing again after the admin publishes a new agreement replaces the old signature (A-16).
  const { error } = await createAdminClient()
    .from("designer_agreements")
    .upsert({
      designer_id: user.id,
      full_name: v.fullName,
      mobile: v.mobile,
      address: v.address,
      address_parts: addr.parts,
      id_front_path: frontPath,
      id_back_path: backPath,
      id_photo_at: new Date().toISOString(),
      id_type: v.idType,
      id_number: v.idNumber,
      signature_name: v.signature,
      version: await currentAgreementVersion(),
      signed_at: new Date().toISOString(),
      signed_ip: await clientIp(),
      user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
      signed_text: signedText,
      // A new signature is reviewed again (owner, 2026-10-12).
      review_status: "needs_review",
      reviewed_by: null,
      reviewed_at: null,
      reject_reason: null,
      photo_requested_at: null,
    });
  if (error) return { ok: false, error: "agreement.errors.generic" };
  return { ok: true, next: safeNext(formData.get("next")) };
}

export type IdPhotoState = { ok: boolean; errors?: { idFront?: MessageKey; idBack?: MessageKey }; error?: MessageKey; next?: string };

/**
 * A designer who signed before ID photos were asked for adds one now (owner, 2026-10-11): the front, and the
 * back of a national ID card. The rest of the agreement stays as it was signed.
 */
export async function addIdPhoto(_prev: IdPhotoState, formData: FormData): Promise<IdPhotoState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || user.status === "banned") return { ok: false, error: "auth.errors.generic" };
  const db = createAdminClient();
  const { data: a } = await db.from("designer_agreements").select("id_type, id_front_path, id_back_path").eq("designer_id", user.id).maybeSingle();
  if (!a) return { ok: false, error: "agreement.errors.required" };
  const idType = a.id_type as "nid" | "passport" | "birth_certificate";
  const front = formFiles(formData, "idFront")[0];
  const back = formFiles(formData, "idBack")[0];
  const errors: IdPhotoState["errors"] = {};
  if (!front) errors.idFront = "agreement.errors.idFront";
  if (needsBackPhoto(idType) && !back) errors.idBack = "agreement.errors.idBack";
  if (Object.keys(errors).length) return { ok: false, errors };

  const stamp = Date.now();
  const frontPath = `${user.id}/front-${stamp}.jpg`;
  const backPath = needsBackPhoto(idType) ? `${user.id}/back-${stamp}.jpg` : null;
  if (!(await savePhoto(ID_DOCUMENTS_BUCKET, frontPath, front!))) return { ok: false, errors: { idFront: "agreement.errors.idPhotoBad" } };
  if (backPath && !(await savePhoto(ID_DOCUMENTS_BUCKET, backPath, back!))) return { ok: false, errors: { idBack: "agreement.errors.idPhotoBad" } };
  // A new photo goes back to the admins for review (owner, 2026-10-12): also after "Ask for a new photo" or a rejection.
  const { error } = await db
    .from("designer_agreements")
    .update({ id_front_path: frontPath, id_back_path: backPath, id_photo_at: new Date().toISOString(), review_status: "needs_review", reviewed_by: null, reviewed_at: null, reject_reason: null, photo_requested_at: null })
    .eq("designer_id", user.id);
  if (error) return { ok: false, error: "agreement.errors.generic" };
  // The old photos are not kept once replaced.
  const old = [a.id_front_path, a.id_back_path].filter((x): x is string => typeof x === "string" && x !== frontPath && x !== backPath);
  if (old.length) await db.storage.from(ID_DOCUMENTS_BUCKET).remove(old).catch(() => {});
  await notify(await adminIdsWith("agreements.manage"), "agreement_photo_added_admin", { name: user.name }, `/admin/agreements?tab=needs_review`, user.id);
  return { ok: true, next: safeNext(formData.get("next")) };
}
