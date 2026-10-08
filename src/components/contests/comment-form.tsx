"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteComment, postComment, type CommentFormState } from "@/lib/contests/community-actions";
import { deleteEntryComment, postEntryComment } from "@/lib/entries/actions";
import { useI18n } from "@/lib/i18n/client";

/** Contest comments use the contest id; design comments (owner, 2026-10-08) use the entry id. */
type Target = { kind: "contest"; contestId: string } | { kind: "entry"; entryId: string };

/** Comment box at the bottom of the Comments tab and under each design (contest client and designers). */
export function CommentForm({ target, maxLength }: { target: Target; maxLength: number }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [state, action, pending] = useActionState<CommentFormState, FormData>(target.kind === "contest" ? postComment : postEntryComment, { status: "idle" });

  useEffect(() => {
    if (state.status !== "ok") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the box once the server accepted the comment
    setBody("");
    toast(t("contest.comments.posted"));
  }, [state, toast, t]);

  const count = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  return (
    <form action={action} className="space-y-3">
      {target.kind === "contest" ? <input type="hidden" name="contestId" value={target.contestId} /> : <input type="hidden" name="entryId" value={target.entryId} />}
      <TextAreaField
        name="body"
        label={t("contest.comments.label")}
        placeholder={t("contest.comments.placeholder")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={maxLength}
        counterLabel={`${count.format(body.length)} / ${count.format(maxLength)}`}
        error={state.status === "error" && state.error ? t(state.error.key, state.error.params) : undefined}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!body.trim()}>
          {t("contest.comments.post")}
        </Button>
      </div>
    </form>
  );
}

export function DeleteCommentButton({ commentId, kind = "contest" }: { commentId: string; kind?: Target["kind"] }) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("contest.comments.deleteConfirm"))) return;
        start(async () => {
          if (!(await (kind === "contest" ? deleteComment : deleteEntryComment)(commentId))) toast(t("auth.errors.generic"), "danger");
        });
      }}
      className="min-h-9 text-xs font-semibold text-muted hover:text-danger disabled:opacity-50"
    >
      {t("contest.comments.delete")}
    </button>
  );
}
