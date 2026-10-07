import { ButtonLink } from "@/components/ui/button";
import type { ContestComment } from "@/lib/contests/community";
import { cx } from "@/lib/cx";
import { timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { CommentForm, DeleteCommentButton } from "./comment-form";

/** P-03 Comments tab: public list, then the box for the client and designers (BLUEPRINT §10). */
export async function ContestComments({
  contestId,
  comments,
  canComment,
  loginHref,
  maxLength,
}: {
  contestId: string;
  comments: ContestComment[];
  canComment: boolean;
  /** Set for guests, who get a log-in link. */
  loginHref: string | null;
  maxLength: number;
}) {
  const { t, locale } = await getI18n();
  const now = new Date();
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-muted">{t("contest.comments.intro")}</p>

      {comments.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">{t("contest.comments.empty")}</p>
      ) : (
        <ol className="mt-6 space-y-3">
          {comments.map((c) => {
            const isClient = c.author.isContestClient;
            const name = !isClient && c.author.username ? `@${c.author.username}` : c.author.name;
            return (
              <li key={c.id} className={cx("flex gap-3 rounded-lg bg-surface p-4 ring-1", isClient ? "ring-cream" : "ring-line")}>
                <span
                  className={cx(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isClient ? "bg-primary text-white" : "bg-cream text-primary-dark",
                  )}
                  aria-hidden
                >
                  {name.replace(/^@/, "").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-ink">{name}</span>
                    <span
                      className={cx(
                        "rounded px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider",
                        isClient ? "bg-primary text-white" : "bg-canvas text-muted",
                      )}
                    >
                      {isClient ? t("contest.comments.clientBadge") : t("contest.comments.designerBadge")}
                    </span>
                    <time dateTime={c.createdAt.toISOString()} className="text-xs text-muted">
                      {timeAgo(c.createdAt, now, locale)}
                    </time>
                    {c.mine && (
                      <span className="ml-auto">
                        <DeleteCommentButton commentId={c.id} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line break-words leading-relaxed text-ink">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-6 rounded-lg bg-surface p-4 ring-1 ring-line sm:p-5">
        {canComment ? (
          <CommentForm contestId={contestId} maxLength={maxLength} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm text-muted">{loginHref ? t("contest.comments.loginToComment") : t("contest.comments.notAllowed")}</p>
            {loginHref && (
              <ButtonLink href={loginHref} variant="secondary">
                {t("nav.login")}
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
