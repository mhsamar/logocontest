"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { parseLoginIdentifier } from "./identity";
import { clientIp } from "./services";
import { homeForRole } from "./home";
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
  // A page that sent the person to log in wins; otherwise each role has its own landing page.
  const next = formData.get("next");
  if (typeof next === "string" && next) redirect(safeNext(next));
  const profile = id.kind === "email" ? await findProfileByEmail(id.email) : await findProfileByPhone(id.mobile);
  redirect(homeForRole(profile?.role));
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
