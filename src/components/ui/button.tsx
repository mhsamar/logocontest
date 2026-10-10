import Link from "next/link";
import { cx } from "@/lib/cx";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "outline" | "dark" | "ghost" | "danger";
type Size = "md" | "lg" | "xl";

// Buttons from the site design (owner, 2026-10-10; UI-JOURNEY §1): red gradient with a glossy press
// shadow for the main action, white with a line, red outline, dark, plain text, and danger.
const VARIANTS: Record<Variant, string> = {
  primary: "lc-g bg-[image:var(--gradient-red)] text-white hover:brightness-110 disabled:opacity-50 disabled:shadow-none",
  secondary: "border border-line bg-surface text-ink hover:bg-chip disabled:text-muted",
  outline: "lc-sh border-[1.5px] border-primary bg-surface text-primary hover:bg-tint disabled:opacity-50",
  dark: "bg-ink text-white hover:bg-ink/85 disabled:opacity-50",
  ghost: "text-primary hover:bg-tint disabled:text-muted",
  danger: "border border-danger bg-surface text-danger hover:bg-danger/10 disabled:opacity-50",
};

// Every size keeps a 44px+ touch target.
const SIZES: Record<Size, string> = {
  md: "min-h-11 rounded-[14px] px-[18px] text-[15px]",
  lg: "min-h-[52px] rounded-2xl px-7 text-[17px]",
  xl: "min-h-[54px] rounded-2xl px-[30px] text-lg",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function buttonClasses({ variant = "primary", size = "md", block, className }: Omit<CommonProps, "children">) {
  return cx(
    "relative inline-flex items-center justify-center gap-2 font-bold select-none",
    "transition-[color,background-color,box-shadow,transform,filter] duration-200 ease-out active:scale-[0.97]",
    "disabled:cursor-not-allowed disabled:scale-100",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  loading,
  children,
  disabled,
  type = "button",
  ...rest
}: CommonProps & { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant,
  size,
  block,
  className,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, block, className })}>
      {children}
    </Link>
  );
}
