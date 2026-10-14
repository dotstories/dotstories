"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { comments, dotLikes, dotStats } from "@/db/schema";
import { CommentSchema } from "@/lib/comment-schema";
import { getDb } from "@/lib/db";
import { findDot } from "@/lib/dots";

export type LikeResult = { liked: boolean; likes: number } | { login: true } | { error: string };
export type CommentResult = { ok: true } | { login: true } | { error: string };

/** Counter +/- by, never below 0. */
const bump = (slug: string, field: "likes" | "comments", by: number) => {
  const column = dotStats[field];
  const next = sql`max(${column} + ${by}, 0)`;
  return getDb()
    .insert(dotStats)
    .values(field === "likes" ? { slug, likes: Math.max(by, 0) } : { slug, comments: Math.max(by, 0) })
    .onConflictDoUpdate({ target: dotStats.slug, set: field === "likes" ? { likes: next } : { comments: next } });
};

export async function toggleLike(slug: string): Promise<LikeResult> {
  const session = await auth();
  if (!session) return { login: true };
  if (!findDot(slug)) return { error: "Unknown dot." };
  const db = getDb();
  const mine = and(eq(dotLikes.userId, session.user.id), eq(dotLikes.slug, slug));

  const liked = !!(await db.select({ slug: dotLikes.slug }).from(dotLikes).where(mine).get());
  // One batch = one transaction: the like and the counter change together.
  if (liked) await db.batch([db.delete(dotLikes).where(mine), bump(slug, "likes", -1)]);
  else await db.batch([db.insert(dotLikes).values({ userId: session.user.id, slug }), bump(slug, "likes", 1)]);

  const stats = await db.select({ likes: dotStats.likes }).from(dotStats).where(eq(dotStats.slug, slug)).get();
  return { liked: !liked, likes: stats?.likes ?? 0 };
}

export async function addComment(values: unknown): Promise<CommentResult> {
  const session = await auth();
  if (!session) return { login: true };
  const parsed = CommentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { slug, text, parentId } = parsed.data;
  if (!findDot(slug)) return { error: "Unknown dot." };

  const db = getDb();
  if (parentId) {
    // Replies go one level deep, on the same dot.
    const parent = await db.select().from(comments).where(eq(comments.id, parentId)).get();
    if (!parent || parent.slug !== slug || parent.parentId || parent.deletedAt) return { error: "You can't reply to that." };
  }
  await db.batch([db.insert(comments).values({ slug, text, parentId, userId: session.user.id }), bump(slug, "comments", 1)]);
  revalidatePath(`/dots/${slug}`);
  return { ok: true };
}

/**
 * Delete my comment. The text is gone right away (we keep no copy).
 * Nobody replied → the row is removed. Others replied → their replies stay, under "[deleted]" without an author.
 */
export async function deleteComment(id: string): Promise<CommentResult> {
  const session = await auth();
  if (!session) return { login: true };
  const db = getDb();
  const comment = await db.select().from(comments).where(eq(comments.id, id)).get();
  if (!comment || comment.deletedAt || comment.userId !== session.user.id) return { error: "You can only delete your own comments." };

  const hasReplies = !comment.parentId && !!(await db.select({ id: comments.id }).from(comments).where(eq(comments.parentId, id)).get());
  await db.batch([
    hasReplies
      ? db.update(comments).set({ text: "", deletedAt: new Date() }).where(eq(comments.id, id))
      : db.delete(comments).where(eq(comments.id, id)),
    // Its last reply is gone → an empty "[deleted]" parent has nothing left to hold together.
    db
      .delete(comments)
      .where(
        and(
          eq(comments.id, comment.parentId ?? ""),
          isNotNull(comments.deletedAt),
          sql`NOT EXISTS (SELECT 1 FROM comment AS reply WHERE reply.parentId = ${comment.parentId ?? ""})`,
        ),
      ),
    bump(comment.slug, "comments", -1),
  ]);
  revalidatePath(`/dots/${comment.slug}`);
  return { ok: true };
}
