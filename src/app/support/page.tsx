import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SupportChat } from "@/components/support/support-chat";
import { PageShell, Panel } from "@/components/ui/panel";
import { PageTitle } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { assistantOn } from "@/lib/support/assistant";
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
  const [{ t }, chat, assistant] = await Promise.all([getI18n(), myConversation(user.id), assistantOn()]);
  if (chat.thread && chat.thread.unreadByUser > 0) await createAdminClient().from("support_threads").update({ unread_by_user: 0 }).eq("id", chat.thread.id);
  return (
    <PageShell>
      <Panel className="flex flex-1 flex-col py-6 sm:py-8">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          <PageTitle lead={t("support.title")} sub={t("support.lead")} />
          {/* Fits the screen, so the box to type in is always in view without scrolling (owner, 2026-10-15). */}
          <div className="lc-card mt-4 flex h-[clamp(20rem,calc(100dvh-17rem),36rem)] flex-col overflow-hidden bg-frame">
            <SupportChat initial={chat.messages} initialThread={chat.thread} initialAssistant={assistant} className="flex-1" />
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}
