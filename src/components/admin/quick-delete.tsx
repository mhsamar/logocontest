"use client";

import { useTransition } from "react";
import { AdminIcon } from "@/components/admin/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { quickDeleteContest, quickDeleteUser, restoreContestFromTrash, restoreUserFromTrash } from "@/lib/admin/trash-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * One-click delete in the Contests and Users lists (owner, 2026-10-18). It goes to the Trash at once, like Delete on
 * the detail page, and the toast offers Undo; the Trash page can still restore it later. The server keeps every rule
 * (no admins, not yourself, no account with live contests, files to deliver or wallet money) and says why.
 */
export function QuickDelete({ kind, id, name, className }: { kind: "contest" | "user"; id: string; name: string; className?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, start] = useTransition();

  const undo = async () => {
    const back = kind === "contest" ? await restoreContestFromTrash(id) : await restoreUserFromTrash(id);
    toast(back.ok ? t("admin.trash.restored") : t(back.error), back.ok ? "success" : "danger");
  };

  const run = () =>
    start(async () => {
      const res = kind === "contest" ? await quickDeleteContest(id) : await quickDeleteUser(id);
      if (!res.ok) return void toast(t(res.error), "danger");
      toast(t("admin.trash.quick.done", { name }), "success", { label: t("admin.trash.quick.undo"), run: () => void undo() });
    });

  return (
    <button
      type="button"
      onClick={(e) => {
        // Rows and cards open the contest or the user on click; this button only deletes.
        e.preventDefault();
        e.stopPropagation();
        run();
      }}
      disabled={busy}
      aria-label={t("admin.trash.quick.label", { name })}
      title={t("admin.trash.quick.title")}
      data-quick-delete={kind}
      className={cx(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-[#FDE3E1] hover:text-[#A3121B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A3121B] disabled:opacity-60",
        className,
      )}
    >
      {busy ? <Spinner className="size-4" /> : <AdminIcon name="trash" size={19} />}
    </button>
  );
}
