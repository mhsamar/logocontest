"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AdminAction } from "@/components/admin/admin-action";
import { useReadOnly } from "@/components/admin/read-only";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { decideGuaranteeClaim, markGuaranteeRefunded, startPaying } from "@/lib/guarantee/actions";
import { useI18n } from "@/lib/i18n/client";

/** A-27 Admin › Money-back claims (owner, 2026-10-21): approve or reject a waiting claim. */
export function GuaranteeDecide({
  claimId,
  number,
  amount,
  min,
  repickDays,
  canExclude,
  counted,
  late = false,
}: {
  claimId: string;
  /** The contest number as shown (LC-0012): typing it confirms the approval. */
  number: string;
  amount: string;
  min: number;
  repickDays: number;
  /** Only the Super admin may leave designers out of the count. */
  canExclude: boolean;
  /** Counted designers: @username (or name) → id, to read the "leave out" lines. */
  counted: { label: string; id: string }[];
  /** A claim after a no-result end: rejecting gives no more days to pick. */
  late?: boolean;
}) {
  const { t, locale } = useI18n();
  const n = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  // "@rahim — same person as @karim" lines → [{designer_id, reason}]; an unknown name is sent as is and refused.
  const exclusions = (text: string) =>
    JSON.stringify(
      text
        .split(/[\n;]/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [who, ...rest] = line.split(/\s+[—–-]\s+|:\s+/);
          const key = who.trim().toLowerCase();
          const hit = counted.find((c) => c.label.toLowerCase() === key || c.label.toLowerCase() === `@${key}`);
          return { designer_id: hit?.id ?? who.trim(), reason: rest.join(" ").trim() };
        }),
    );
  // Enough designers counted ("please check the count"): only the Super admin can approve, by leaving some out.
  const approvable = canExclude || counted.length < min;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!approvable && <span className="text-sm text-muted">{t("guarantee.admin.superOnly")}</span>}
      {approvable && <AdminAction
        label={t("guarantee.admin.approve")}
        title={t("guarantee.admin.approveTitle")}
        body={t("guarantee.admin.approveBody", { amount })}
        confirm={t("guarantee.admin.approve")}
        done={t("guarantee.admin.approved")}
        tone="primary"
        fields={[
          { name: "confirm", kind: "text", label: t("guarantee.admin.confirmLabel", { number }) },
          ...(canExclude ? [{ name: "exclude", kind: "text" as const, label: t("guarantee.admin.exclude"), hint: t("guarantee.admin.excludeHint") }] : []),
          { name: "internal", kind: "text", label: t("guarantee.admin.internalLabel") },
        ]}
        run={(f) => decideGuaranteeClaim({ claimId, approve: true, confirm: f.confirm, exclude: f.exclude?.trim() ? exclusions(f.exclude) : "", internal: f.internal })}
      />}
      <AdminAction
        label={t("guarantee.admin.reject")}
        title={t("guarantee.admin.rejectTitle")}
        body={late ? t("guarantee.admin.rejectBodyLate") : t("guarantee.admin.rejectBody", { days: n.format(repickDays) })}
        done={t("guarantee.admin.rejected")}
        tone="danger"
        fields={[
          {
            name: "reply",
            kind: "reason",
            hint: t("guarantee.admin.replyHint"),
            suggestions: (["enough", "rules", "outside", "late"] as const).map((k) => ({ label: t(`guarantee.admin.reasons.${k}.label`), text: t(`guarantee.admin.reasons.${k}.text`, { n: n.format(min) }) })),
          },
          { name: "internal", kind: "text", label: t("guarantee.admin.internalLabel") },
        ]}
        run={(f) => decideGuaranteeClaim({ claimId, approve: false, reply: f.reply, internal: f.internal })}
      />
    </div>
  );
}

/** An approved claim: "I'm sending it", then the reference of each refund. */
export function GuaranteePay({ claimId, routes, lockedByOther, mine }: { claimId: string; routes: { key: string; label: string }[]; lockedByOther: boolean; /** This person pressed "I'm sending it". */ mine: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  // Someone else is sending it (the card says who): only they can finish it, until their lock runs out.
  if (readOnly || lockedByOther) return null;
  // First "I'm sending it" (one person pays), then the references.
  if (!mine)
    return (
      <Button
        variant="secondary"
        loading={busy}
        onClick={() =>
          start(async () => {
            const res = await startPaying(claimId);
            if (!res.ok) return toast(t(res.error), "danger");
            router.refresh();
          })
        }
      >
        {t("guarantee.admin.startPaying")}
      </Button>
    );
  return (
    <div className="flex flex-wrap gap-2">
      <AdminAction
        label={t("guarantee.admin.markRefunded")}
        title={t("guarantee.admin.markTitle")}
        body={t("guarantee.admin.markBody")}
        done={t("guarantee.admin.refunded")}
        tone="primary"
        fields={routes.map((r) => ({ name: r.key, kind: "text" as const, label: r.label }))}
        run={(f) => markGuaranteeRefunded({ claimId, refs: f })}
      />
    </div>
  );
}
