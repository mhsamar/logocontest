import { cx } from "@/lib/cx";

const TONES = {
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export function Alert({ tone = "info", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-[14px] px-4 py-3 text-[15px] font-medium", TONES[tone])}>
      {children}
    </div>
  );
}
