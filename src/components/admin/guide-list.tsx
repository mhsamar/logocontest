"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { useReadOnly } from "./read-only";

/** "New guide", for staff who may change content. */
export function AddGuideLink() {
  const { t } = useI18n();
  if (useReadOnly()) return null;
  return (
    <Link href="/admin/guides/new" className="inline-flex min-h-12 items-center gap-2 rounded-[12px] bg-primary px-5 text-[15.5px] font-bold text-white hover:bg-primary-hi">
      + {t("admin.guides.new")}
    </Link>
  );
}
