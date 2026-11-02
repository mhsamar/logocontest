"use client";

/**
 * A filter dropdown that applies itself (owner, 2026-11-02: picking a contest on Admin › Designs did nothing until
 * "Filter" was pressed): a change submits its form. The Filter button stays for the search box.
 */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
