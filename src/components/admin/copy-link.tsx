"use client";

import { useState } from "react";
import { AdminIcon } from "./icons";

/** Copies a link and says so for a moment (admin buttons). */
export function CopyLink({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt(label, value);
        }
      }}
      className="inline-flex h-11 items-center gap-2 rounded-[12px] border border-adm-line bg-surface px-4 text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary"
    >
      <AdminIcon name={copied ? "check" : "claims"} size={16} />
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
