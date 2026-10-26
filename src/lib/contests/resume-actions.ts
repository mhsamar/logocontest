"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { markLoggedOut } from "@/lib/auth/sessions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { noteResume, resumeSecret, resumeTarget } from "./resume";
import { readResumeToken } from "./resume-token";

/**
 * "Continue my contest" on a resume link's page (owner, 2026-10-26): signs the contest's client in on this device and
 * opens the draft at the step where they stopped, without a password. Only from this button, never on opening the
 * link: WhatsApp previews and email scanners open links too, and would otherwise sign the client in on their servers
 * (and push the client's own devices out of the device limit). Staff are never switched to a client this way.
 */
export async function resumeContest(token: string): Promise<void> {
  const back = `/r/${encodeURIComponent(token)}`;
  const read = readResumeToken(resumeSecret(), token);
  const target = read ? await resumeTarget(read.contestId) : null;
  if (!target) redirect(back);
  const me = await getCurrentUser();
  if (me?.id === target.clientId) redirect(target.href);
  if (me?.role === "admin") redirect(back);

  const db = createAdminClient();
  const { data: auth } = await db.auth.admin.getUserById(target.clientId);
  const email = auth?.user?.email;
  const { data: link } = email ? await db.auth.admin.generateLink({ type: "magiclink", email }) : { data: null };
  if (!link?.properties?.hashed_token) redirect(`${back}?failed=1`);

  const supabase = await createClient();
  // Someone else's login on this device ends here (this device only); a "Log in as" mark never carries over.
  if (me) {
    await markLoggedOut();
    await supabase.auth.signOut({ scope: "local" });
  }
  (await cookies()).delete("lc_as");
  const { data: verified, error } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (error || !verified.session) redirect(`${back}?failed=1`);

  // In the lead's History, and the sign-in in the audit log (no phone numbers).
  await noteResume(target.contestId, "resume_opened", null);
  const h = await headers();
  await db.from("audit_logs").insert({ admin_id: null, action: "resume_link_signin", subject_type: "contest", subject_id: target.contestId, changes: { country: h.get("x-vercel-ip-country") } });
  redirect(target.href);
}
