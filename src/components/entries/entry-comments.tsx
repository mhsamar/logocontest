import { CommentForm, DeleteCommentButton } from "@/components/contests/comment-form";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { timeAgo } from "@/lib/dates";
import type { EntryComment } from "@/lib/entries/queries";
import { getI18n } from "@/lib/i18n/server";

/** The comment box on one design (BLUEPRINT §10, owner 2026-10-08). */
export async function EntryComments({
  entryId,
  comments,
  canComment,
  reason,
  loginHref,
  maxLength,
}: {
  entryId: string;
  comments: EntryComment[];
  canComment: boolean;
  /** Why the box is missing: a guest, a designer on someone else's design (owner, 2026-10-11), or anyone else. */
  reason: "login" | "ownOnly" | "notAllowed";
  loginHref: string;
  maxLength: number;
}) {
  const { t, locale } = await getI18n();
  const now = new Date();
  return (
    <section aria-labelledby={`entry-comments-${entryId}`}>
      <h3 id={`entry-comments-${entryId}`} className="font-semibold text-ink">
        {t("entry.comments.title")}
      </h3>
      <p className="mt-1 text-xs text-muted">{t("entry.comments.intro")}</p>

      {comments.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-5 text-center text-sm text-muted">{t("entry.comments.empty")}</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {comments.map((c) => {
            const isClient = c.author.isContestClient;
            const name = !isClient && c.author.username ? `@${c.author.username}` : c.author.name;
            return (
              <li key={c.id} className={cx("rounded-lg p-3", isClient ? "bg-cream/60" : "bg-canvas")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-ink">{name}</span>
                  {isClient && <span className="rounded bg-primary px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-white">{t("contest.comments.clientBadge")}</span>}
                  <time dateTime={c.createdAt.toISOString()} className="text-xs text-muted">
                    {timeAgo(c.createdAt, now, locale)}
                  </time>
                  {c.mine && (
                    <span className="ml-auto">
                      <DeleteCommentButton commentId={c.id} kind="entry" />
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{c.body}</p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4">
        {canComment ? (
          <CommentForm target={{ kind: "entry", entryId }} maxLength={maxLength} />
        ) : (
          <div className="rounded-lg bg-canvas p-3 text-center text-sm text-muted">
            <p>{t(`entry.comments.${reason}`)}</p>
            {reason === "login" && (
              <ButtonLink href={loginHref} variant="secondary" className="mt-2">
                {t("nav.login")}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
