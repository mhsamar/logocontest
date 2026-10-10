import { cx } from "@/lib/cx";

type Tone = "white" | "red" | "gold" | "tint" | "ink" | "grey" | "green" | "orange" | "soonRed";

// Badges and chips from the site design (owner, 2026-10-10; UI-JOURNEY §1).
const TONES: Record<Tone, string> = {
  white: "border border-line bg-surface text-ink",
  red: "bg-primary text-white",
  gold: "bg-gold text-gold-ink",
  tint: "bg-tint text-primary",
  ink: "bg-ink text-white",
  grey: "bg-chip text-ink",
  green: "bg-[#DDF1E3] text-[#1D5B37]",
  orange: "bg-[#FFEDD5] text-[#9A3412]",
  soonRed: "bg-[#FDE3E1] text-[#A3121B]",
};

/** Round badge ("Featured", "Urgent", "Highlighted", days left). */
export function Badge({ tone = "white", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-bold", TONES[tone], className)}>{children}</span>;
}

/** Squarer chip for labels like the package name ("Elite", "Growth") or file types. */
export function Chip({ tone = "grey", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-lg px-2.5 py-1 text-[13px] font-bold", TONES[tone], className)}>{children}</span>;
}
