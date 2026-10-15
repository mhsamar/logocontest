"use client";

import { useState } from "react";
import { cx } from "@/lib/cx";
import { AdminIcon } from "./icons";

/** A small Copy button beside a number or ID (owner, 2026-10-16: copy the bKash number to pay). */
export function CopyValue({ value, label, done, className }: { value: string; label: string; done: string; className?: string }) {
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
      className={cx(
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[12px] px-4 text-[15px] font-bold transition-colors",
        copied ? "bg-adm-good-bg text-adm-good" : "bg-primary text-white hover:bg-adm-deep",
        className,
      )}
      data-copy={value}
    >
      <AdminIcon name={copied ? "check" : "claims"} size={16} />
      <span aria-live="polite">{copied ? done : label}</span>
    </button>
  );
}
