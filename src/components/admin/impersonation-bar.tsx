import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { endImpersonation } from "@/lib/admin/security-actions";
import { getI18n } from "@/lib/i18n/server";

/** Super admin's "Log in as this user" (owner, 2026-10-14): whose account this is, and the way back. */
export async function ImpersonationBar() {
  const raw = (await cookies()).get("lc_as")?.value;
  if (!raw) return null;
  const [id, name] = raw.split("|");
  const user = await getCurrentUser();
  if (!user || user.id !== id) return null;
  const { t } = await getI18n();
  return (
    <div className="sticky top-0 z-[90] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[#5b0a0a] px-4 py-2.5 text-center text-[14.5px] font-semibold text-white">
      <span>{t("admin.security.viewingAs", { name: name || user.name })}</span>
      <form action={endImpersonation}>
        <button type="submit" className="min-h-9 rounded-[10px] bg-white px-3 text-[14px] font-bold text-[#5b0a0a]">
          {t("admin.security.backToAdmin")}
        </button>
      </form>
    </div>
  );
}
