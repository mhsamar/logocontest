import { EmailBanner } from "@/components/auth/email-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

/** Shows the confirm-your-email bar for signed-in users whose email isn't confirmed yet. */
export async function EmailBannerSlot() {
  const user = await getCurrentUser();
  if (!user?.email || user.emailVerifiedAt) return null;
  return <EmailBanner email={user.email} length={await getSetting("auth.email_code_length")} />;
}
