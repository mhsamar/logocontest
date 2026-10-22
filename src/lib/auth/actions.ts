"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { parseLoginIdentifier } from "./identity";
import { clientIp } from "./services";
import { clientPathFor } from "@/lib/client/rules";
import { homeForRole } from "./home";
import { markLoggedOut } from "./sessions";
import { authEmailForMobile, fail, findProfileByEmail, findProfileByPhone, findProfileByUsername, safeNext, signIn, type AuthFormState } from "./sign-in";

export type { AuthFormState, FormMessage } from "./sign-in";

// ---------------------------------------------------------------------------
// Login (P-11) and logout
// ---------------------------------------------------------------------------

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");

  // P-11: one field that takes a mobile number, an email or a username (owner, 2026-10-15).
  const id = parseLoginIdentifier(String(formData.get("identifier") ?? ""));
  if (!id) return fail("auth.errors.invalidIdentifier", "phone");
  const password = String(formData.get("password") ?? "");
  if (!password) return fail("auth.errors.invalidCredentials", "password");

  const byName = id.kind === "username" ? await findProfileByUsername(id.username) : null;
  const key = id.kind === "email" ? id.email : id.kind === "mobile" ? id.mobile : id.username;
  // An unknown username still goes through the same password check, so it never tells strangers which names exist.
  const authEmail = id.kind === "email" ? id.email : id.kind === "mobile" ? await authEmailForMobile(id.mobile) : (byName?.email ?? `${id.username}@unknown.logocontest.bd`);
  const result = await signIn(key, authEmail, password, await clientIp());
  if (result) return result;
  const profile = id.kind === "email" ? await findProfileByEmail(id.email) : id.kind === "mobile" ? await findProfileByPhone(id.mobile) : byName;
  // A client account on "Log in as a designer" (or the other way round) is told so and not signed in (owner,
  // 2026-10-14). Only after the password was right, so it never tells strangers which accounts exist.
  const as = formData.get("as");
  const role = profile?.role;
  if ((as === "client" || as === "designer") && (role === "client" || role === "designer") && role !== as) {
    // Only the login just made: the person's other devices stay signed in.
    await (await createClient()).auth.signOut({ scope: "local" });
    return { ...fail(role === "client" ? "auth.errors.wrongRoleClient" : "auth.errors.wrongRoleDesigner"), wrongRole: role };
  }
  // A page that sent the person to log in wins; otherwise each role has its own landing page.
  const next = formData.get("next");
  // A client goes straight to the new address of an old link (owner, 2026-10-17: no empty in-between page).
  if (typeof next === "string" && next) redirect(role === "client" ? clientPathFor(safeNext(next)) : safeNext(next));
  redirect(homeForRole(role));
}

// Log out ends this device's login only (owner, 2026-10-22: nobody is signed out anywhere else except by the device
// limit). Admin › Users › Devices can still sign a client or designer out of every device.
export async function logout() {
  if (isSupabaseConfigured()) {
    await markLoggedOut();
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/");
}

/** Sign out from the admin panel: the "You're signed out" page with Sign in again (owner, 2026-10-10). */
export async function adminLogout() {
  if (isSupabaseConfigured()) {
    await markLoggedOut();
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/admin-signed-out");
}
