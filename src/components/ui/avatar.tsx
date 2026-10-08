import { cx } from "@/lib/cx";

/** Profile photo, or the name's initials on a tinted circle when there is none. */
export function Avatar({ name, url, className, tone = "light" }: { name: string; url: string | null; className?: string; tone?: "light" | "cream" }) {
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  return url ? (
    // Public storage URL; next/image would need the Supabase host configured.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cx("shrink-0 rounded-full bg-canvas object-cover", className)} />
  ) : (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        tone === "cream" ? "bg-cream text-ink" : "bg-primary/15 text-primary-dark",
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}
