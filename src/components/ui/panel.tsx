import { cx } from "@/lib/cx";

/**
 * Surfaces from the site design (owner, 2026-10-10; UI-JOURNEY §1).
 * Panel: a big white (or light grey) block with 32px corners, used for page sections.
 * Card: a white card with a thin line and 28px corners. `lift` adds the soft shadow.
 */
export function Panel({ as: Tag = "section", tone = "white", className, children, ...rest }: { as?: "section" | "div" | "header" | "article" | "aside"; tone?: "white" | "grey"; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx("rounded-[32px] px-6 py-10 sm:px-10 sm:py-14 max-[720px]:rounded-[24px] max-[720px]:px-4", tone === "white" ? "bg-surface" : "bg-frame", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Card({ as: Tag = "div", lift = false, className, children, ...rest }: { as?: "div" | "article" | "li" | "section"; lift?: boolean; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx("lc-card", lift && "lc-sh", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Page wrapper for inner pages: the light grey page with the side padding of the home page. */
export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("flex w-full flex-1 flex-col gap-3.5 px-3.5 pb-3.5 max-[720px]:gap-2 max-[720px]:px-2 max-[720px]:pb-2", className)}>{children}</div>;
}
