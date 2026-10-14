import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { comments, dotLikes, users } from "@/db/schema";
import { getDb } from "./db";

export type CommentView = {
  id: string;
  text: string;
  deleted: boolean; // deleted by its author, or its author deleted their account
  createdAt: string;
  user: { id: string; username: string; image: string | null };
  replies: CommentView[];
};

export async function likedBy(userId: string | undefined, slug: string) {
  if (!userId) return false;
  const row = await getDb()
    .select({ slug: dotLikes.slug })
    .from(dotLikes)
    .where(and(eq(dotLikes.userId, userId), eq(dotLikes.slug, slug)))
    .get();
  return !!row;
}

/** Newest conversations first; replies in the order they were written. */
export async function commentsFor(slug: string): Promise<CommentView[]> {
  const rows = await getDb()
    .select({
      id: comments.id,
      text: comments.text,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
      accountDeleted: users.deletedAt,
      userId: users.id,
      username: users.username,
      image: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.slug, slug))
    .orderBy(asc(comments.createdAt))
    .all();

  const view = (r: (typeof rows)[number]): CommentView => ({
    id: r.id,
    text: r.deletedAt ? "" : r.text,
    deleted: !!r.deletedAt,
    createdAt: r.createdAt.toISOString(),
    // Deleted: no author shown (or sent), so nobody can tell whose it was.
    user: r.deletedAt
      ? { id: "", username: r.accountDeleted ? "Deleted user" : "[deleted]", image: null }
      : { id: r.userId, username: r.username, image: r.image },
    replies: [],
  });
  const top = new Map(rows.filter((r) => !r.parentId).map((r) => [r.id, view(r)]));
  for (const r of rows) if (r.parentId) top.get(r.parentId)?.replies.push(view(r));
  return [...top.values()].reverse();
}
