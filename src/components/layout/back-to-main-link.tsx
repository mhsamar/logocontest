"use client";

import { usePathname } from "next/navigation";

/** The same page on logocontest.bd (owner, 2026-10-21): a plain link, never an automatic move. */
export function BackToMainLink({ main, label }: { main: string; label: string }) {
  const path = usePathname() || "/";
  return (
    <a href={`${main}${path.startsWith("/") ? path : "/"}`} className="font-bold underline underline-offset-2">
      {label}
    </a>
  );
}
