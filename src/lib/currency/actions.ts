"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE, isCurrency } from "./rules";

/** The footer's ৳ / $ switch (owner, 2026-10-14): remembered for a year on this browser. */
export async function setCurrency(formData: FormData) {
  const code = formData.get("currency");
  if (!isCurrency(code)) return;
  (await cookies()).set(CURRENCY_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  // Every price on the page shows again in the new currency.
  refresh();
}
