"use client";

import { Button, InlineNotification, TextArea } from "@carbon/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { addComment, deleteComment } from "@/actions/social";
import { COMMENT_MAX } from "@/lib/comment-schema";
import type { CommentView } from "@/lib/social";
import { timeAgo } from "@/lib/share";
import Avatar from "./avatar";

type Me = { id: string } | null;

/** Comments like the old DotStories: avatar, name, text, time · Reply. */
export default function Comments({ slug, comments, me }: { slug: string; comments: CommentView[]; me: Me }) {
  return (
    <section id="comments" aria-labelledby="comments-title" className="flex flex-col gap-6">
      <h2 id="comments-title" className="text-lg font-semibold">
        Comments
      </h2>
      {me ? (
        <CommentForm slug={slug} />
      ) : (
        <Link href={`/login?next=${encodeURIComponent(`/dots/${slug}#comments`)}`} className="cds--btn cds--btn--primary self-start">
          Log in to comment
        </Link>
      )}
      {comments.length === 0 && <p className="text-sm text-[var(--cds-text-secondary)]">No comments yet.</p>}
      <ol className="flex flex-col gap-6">
        {comments.map((c) => (
          <li key={c.id}>
            <Comment slug={slug} comment={c} me={me} />
            {c.replies.length > 0 && (
              <ol className="mt-4 flex flex-col gap-4 pl-12">
                {c.replies.map((r) => (
                  <li key={r.id}>
                    <Comment slug={slug} comment={r} me={me} isReply />
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Comment({ slug, comment, me, isReply = false }: { slug: string; comment: CommentView; me: Me; isReply?: boolean }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [, remove, removing] = useActionState(async () => {
    await deleteComment(comment.id);
    router.refresh();
    return null;
  }, null);

  return (
    <article className="flex gap-3" aria-label={`Comment by ${comment.user.username}`}>
      <Avatar src={comment.user.image} name={comment.user.username} size={36} />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-semibold">{comment.user.username}</span>
        {comment.deleted ? (
          <p className="text-sm italic text-[var(--cds-text-secondary)]">[deleted]</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{comment.text}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-[var(--cds-text-secondary)]">
          <time dateTime={comment.createdAt} suppressHydrationWarning>{timeAgo(comment.createdAt)}</time>
          {me && !isReply && (
            <button type="button" className="cds--link text-xs" onClick={() => setReplying(!replying)}>
              Reply
            </button>
          )}
          {me?.id === comment.user.id && (
            <form action={remove}>
              <button type="submit" className="cds--link text-xs" disabled={removing}>
                Delete
              </button>
            </form>
          )}
        </div>
        {replying && <CommentForm slug={slug} parentId={comment.id} onDone={() => setReplying(false)} />}
      </div>
    </article>
  );
}

function CommentForm({ slug, parentId, onDone }: { slug: string; parentId?: string; onDone?: () => void }) {
  const router = useRouter();
  const [error, post, posting] = useActionState(async (_: string, form: FormData) => {
    const r = await addComment({ slug, parentId, text: form.get("text") });
    if ("error" in r) return r.error;
    if ("login" in r) {
      router.push(`/login?next=${encodeURIComponent(`/dots/${slug}#comments`)}`);
      return "";
    }
    onDone?.();
    router.refresh();
    return "";
  }, "");

  return (
    <form action={post} className="flex flex-col gap-2">
      <TextArea
        id={parentId ? `reply-${parentId}` : "comment"}
        name="text"
        labelText={parentId ? "Reply" : "Add a comment"}
        rows={parentId ? 2 : 3}
        maxCount={COMMENT_MAX}
        enableCounter
        required
      />
      {error && <InlineNotification kind="error" title={error} lowContrast hideCloseButton role="alert" />}
      <Button type="submit" size="sm" disabled={posting} className="self-start">
        {parentId ? "Reply" : "Post"}
      </Button>
    </form>
  );
}
