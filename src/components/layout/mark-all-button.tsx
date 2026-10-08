"use client";

import { useTransition } from "react";
import { markAllRead } from "@/lib/notifications/actions";

export function MarkAllButton({ label }: { label: string }) {
  const [busy, start] = useTransition();
  return (
    <button type="button" disabled={busy} onClick={() => start(() => markAllRead())} className="min-h-10 text-sm font-semibold text-primary hover:underline disabled:opacity-50">
      {label}
    </button>
  );
}
