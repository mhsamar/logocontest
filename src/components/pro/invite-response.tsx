"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { respondToInvite } from "@/lib/pro/invite-actions";

/** Accept or decline a contest invitation (owner, 2026-10-14). Only the choice still open is shown. */
export function InviteResponse({ contestId, status }: { contestId: string; status: "pending" | "accepted" | "declined" }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const answer = (decision: "accepted" | "declined") =>
    start(async () => {
      const res = await respondToInvite(contestId, decision);
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t(decision === "accepted" ? "pro.invitations.acceptedToast" : "pro.invitations.declinedToast"));
      router.refresh();
    });
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8 }}>
      {status !== "accepted" && (
        <button type="button" className="pr-btn sm" disabled={busy} onClick={() => answer("accepted")}>
          {t("pro.invitations.accept")}
        </button>
      )}
      {status !== "declined" && (
        <button type="button" className="pr-out sm" disabled={busy} onClick={() => answer("declined")}>
          {t("pro.invitations.decline")}
        </button>
      )}
    </span>
  );
}
