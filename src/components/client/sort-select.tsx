"use client";

import { useRouter } from "next/navigation";

/** "Sort: Needs my action" (Design/client-premium): changing it opens the same list in the new order. */
export function SortSelect({ id, label, value, options }: { id: string; label: string; value: string; options: { value: string; label: string; href: string }[] }) {
  const router = useRouter();
  return (
    <span className="psel">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => router.push(options.find((o) => o.value === e.target.value)?.href ?? "", { scroll: false })} data-sort>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
