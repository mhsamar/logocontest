import { cx } from "@/lib/cx";

/** Contest statuses (BLUEPRINT §6) plus the entry "rejected" chip (UI-JOURNEY §1.3). */
export type ChipStatus =
  | "draft"
  | "pending_payment"
  | "open"
  | "judging"
  | "winner_selected"
  | "handover"
  | "completed"
  | "cancelled"
  | "rejected";

const STYLES: Record<ChipStatus, string> = {
  draft: "bg-muted/15 text-muted",
  pending_payment: "bg-muted/15 text-muted",
  open: "bg-success/10 text-success",
  judging: "bg-warning/10 text-warning",
  winner_selected: "bg-info/10 text-info",
  handover: "bg-info/10 text-info",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-danger/10 text-danger",
  rejected: "bg-danger/10 text-danger",
};

export function StatusChip({ status, label }: { status: ChipStatus; label: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", STYLES[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
