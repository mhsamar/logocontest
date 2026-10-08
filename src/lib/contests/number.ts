/** "#00001": the running contest number (owner, 2026-10-08; BLUEPRINT §2), in the page's digits. */
export function formatContestNumber(n: number, locale: "en" | "bn"): string {
  return `#${new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", { minimumIntegerDigits: 5, useGrouping: false }).format(n)}`;
}
