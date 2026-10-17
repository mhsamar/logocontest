import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SupportChat } from "@/components/support/support-chat";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { assistantOn } from "@/lib/support/assistant";
import { myConversation } from "@/lib/support/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("support.metaTitle"), robots: { index: false } };
}

// Premium client workspace › Help (owner, 2026-10-17: the right-side menu stays on every client page): the same chat
// with the team as /support (S-01).
export default async function ClientHelpPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fhelp");
  if (user.role !== "client") redirect("/support");
  const [{ t }, chat, assistant] = await Promise.all([getI18n(), myConversation(user.id), assistantOn()]);
  if (chat.thread && chat.thread.unreadByUser > 0) await createAdminClient().from("support_threads").update({ unread_by_user: 0 }).eq("id", chat.thread.id);
  return (
    <>
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("support.title")}</h1>
          </div>
          <p>{t("support.lead")}</p>
        </div>
      </div>
      {/* Fits the screen, so the box to type in is always in view without scrolling (owner, 2026-10-15). */}
      <div className="lc-card flex h-[clamp(20rem,calc(100dvh-17rem),36rem)] flex-col overflow-hidden bg-frame">
        <SupportChat initial={chat.messages} initialThread={chat.thread} initialAssistant={assistant} className="flex-1" />
      </div>
    </>
  );
}
