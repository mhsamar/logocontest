"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { parseLoginIdentifier } from "./identity";
import { clientIp } from "./services";
import { homeForRole } from "./home";
import { markLoggedOut } from "./sessions";
import { authEmailForMobile, fail, findProfileByEmail, findProfileByPhone, safeNext, signIn, type AuthFormState } from "./sign-in";

export type { AuthFormState, FormMessage } from "./sign-in";

// ---------------------------------------------------------------------------
// Login (P-11) and logout
// ---------------------------------------------------------------------------

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return fail("auth.errors.notConfigured");

  // P-11: one field that takes a mobile number or an email.
  const id = parseLoginIdentifier(String(formData.get("identifier") ?? ""));
  if (!id) return fail("auth.errors.invalidIdentifier", "phone");
  const password = String(formData.get("password") ?? "");
  if (!password) return fail("auth.errors.invalidCredentials", "password");

  const key = id.kind === "email" ? id.email : id.mobile;
  const authEmail = id.kind === "email" ? id.email : await authEmailForMobile(id.mobile);
  const result = await signIn(key, authEmail, password, await clientIp());
  if (result) return result;
  const profile = id.kind === "email" ? await findProfileByEmail(id.email) : await findProfileByPhone(id.mobile);
  // A client account on "Log in as a designer" (or the other way round) is told so and not signed in (owner,
  // 2026-10-14). Only after the password was right, so it never tells strangers which accounts exist.
  const as = formData.get("as");
  const role = profile?.role;
  if ((as === "client" || as === "designer") && (role === "client" || role === "designer") && role !== as) {
    await (await createClient()).auth.signOut();
    return { ...fail(role === "client" ? "auth.errors.wrongRoleClient" : "auth.errors.wrongRoleDesigner"), wrongRole: role };
  }
  // A page that sent the person to log in wins; otherwise each role has its own landing page.
  const next = formData.get("next");
  if (typeof next === "string" && next) redirect(safeNext(next));
  redirect(homeForRole(role));
}

export async function logout() {
  if (isSupabaseConfigured()) {
    await markLoggedOut();
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

/** Sign out from the admin panel: the "You're signed out" page with Sign in again (owner, 2026-10-10). */
export async function adminLogout() {
  if (isSupabaseConfigured()) {
    await markLoggedOut();
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/admin-signed-out");
}
