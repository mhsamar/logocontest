"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./config";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Re-render every server component (header, footer, page) in the new language.
  refresh();
}
