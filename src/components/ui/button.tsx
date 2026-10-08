import Link from "next/link";
import { cx } from "@/lib/cx";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "btn-sheen bg-primary text-white hover:-translate-y-px hover:bg-primary-dark hover:shadow-[0_10px_24px_-10px_rgb(139_0_0/0.6)] active:bg-primary-dark disabled:bg-primary/40 disabled:shadow-none",
  secondary:
    "bg-surface text-ink ring-1 ring-inset ring-line hover:bg-canvas active:bg-line disabled:text-muted",
  ghost: "text-primary-dark hover:bg-primary/10 active:bg-primary/15 disabled:text-muted",
  danger: "bg-surface text-danger ring-1 ring-inset ring-danger hover:bg-danger/10 active:bg-danger/15 disabled:opacity-50",
};

// Both sizes keep a 44px+ touch target.
const SIZES: Record<Size, string> = {
  md: "min-h-11 px-4 text-[0.9375rem]",
  lg: "min-h-12 px-6 text-base",
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
    "relative inline-flex items-center justify-center gap-2 overflow-clip rounded-full font-semibold select-none",
    "transition-[color,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]",
    "disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100",
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
