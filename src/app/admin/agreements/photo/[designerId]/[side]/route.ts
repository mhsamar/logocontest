import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { ID_DOCUMENTS_BUCKET } from "@/lib/uploads/photos";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * A designer's ID photo (owner, 2026-10-10). Like the full ID number it needs Agreements "manage", and every
 * view is written to the audit log; the photo opens through a link that works for one minute.
 */
export async function GET(_req: Request, { params }: RouteContext<"/admin/agreements/photo/[designerId]/[side]">) {
  const { designerId, side } = await params;
  const user = await adminUser("agreements.manage");
  if (!user || !UUID.test(designerId) || (side !== "front" && side !== "back")) return new NextResponse("Not found", { status: 404 });
  const db = createAdminClient();
  const { data } = await db.from("designer_agreements").select("id_front_path, id_back_path").eq("designer_id", designerId).maybeSingle();
  const path = (side === "front" ? data?.id_front_path : data?.id_back_path) as string | null | undefined;
  if (!path) return new NextResponse("Not found", { status: 404 });
  const { error } = await db.from("audit_logs").insert({ admin_id: user.id, action: "view_id_photo", subject_type: "designer_agreement", subject_id: designerId, changes: { side } });
  if (error) return new NextResponse("Not found", { status: 404 }); // no log, no photo
  const { data: signed } = await db.storage.from(ID_DOCUMENTS_BUCKET).createSignedUrl(path, 60);
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
