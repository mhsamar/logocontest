"use client";

import { pushEndpoint } from "@/lib/push/client";

/**
 * Every Log out form (owner, 2026-10-22): adds this browser's notification address at the moment of logging out, so
 * Log out stops this browser's notifications (also right after Turn on, without a page load in between).
 */
export function LogoutForm({ action, className, children }: { action: (form: FormData) => void | Promise<void>; className?: string; children: React.ReactNode }) {
  return (
    <form
      className={className}
      action={async (form) => {
        form.set("push_endpoint", await pushEndpoint());
        await action(form);
      }}
    >
      {children}
    </form>
  );
}
