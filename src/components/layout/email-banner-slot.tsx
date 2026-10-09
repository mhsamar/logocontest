import { EmailBanner } from "@/components/auth/email-banner";
import { getCurrentUser } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

/** Shows the confirm-your-email bar for signed-in clients and designers whose email isn't confirmed yet. */
export async function EmailBannerSlot() {
  const user = await getCurrentUser();
  // Admins are set up by hand (npm run seed), so they are never asked to confirm by code.
  if (!user?.email || user.emailVerifiedAt || user.role === "admin") return null;
  return <EmailBanner email={user.email} length={await getSetting("auth.email_code_length")} />;
}
