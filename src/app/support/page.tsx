import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SupportChat } from "@/components/support/support-chat";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { myConversation } from "@/lib/support/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("support.metaTitle"), robots: { index: false } };
}

// S-01 Support (BLUEPRINT §13.2 item 5): the signed-in user's chat with the team.
export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fsupport");
  if (user.role === "admin") redirect("/admin/support");
  const [{ t }, chat] = await Promise.all([getI18n(), myConversation(user.id)]);
  if (chat.thread && chat.thread.unreadByUser > 0) await createAdminClient().from("support_threads").update({ unread_by_user: 0 }).eq("id", chat.thread.id);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-8 pt-6 sm:pt-10">
      <h1 className="animate-rise text-h1 font-bold tracking-tight text-ink lg:text-h1-lg">{t("support.title")}</h1>
      <p className="mt-1 text-muted">{t("support.lead")}</p>
      <div className="mt-5 flex h-[min(40rem,70vh)] flex-col overflow-hidden rounded-3xl bg-canvas shadow-card ring-1 ring-line">
        <SupportChat initial={chat.messages} className="flex-1" />
      </div>
    </div>
  );
}
