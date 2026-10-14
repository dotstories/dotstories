"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { comments, dotLikes, dotStats, emailCodes, passwordResets, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { deleteFolder } from "@/lib/storage";
import { getUserById } from "@/lib/users";

export type DeleteResult = { ok?: true; error?: string };

/**
 * Delete my account (GDPR right to erasure): the user row and, through ON DELETE CASCADE, logins, sessions,
 * likes, comments (and replies to them) and saved setups; their uploaded files; pending codes and reset links.
 * Like and comment counts are recounted. Then logged out and sent home.
 */
export async function deleteAccount(_prev: DeleteResult, form: FormData): Promise<DeleteResult> {
  const session = await auth();
  if (!session) return { error: "Log in first." };
  const user = await getUserById(session.user.id);
  if (!user) return { error: "Log in first." };
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.username.toLowerCase())
    return { error: "Type your username exactly to confirm." };

  const db = getDb();
  const [liked, commented] = await Promise.all([
    db.select({ slug: dotLikes.slug }).from(dotLikes).where(eq(dotLikes.userId, user.id)),
    db.select({ slug: comments.slug }).from(comments).where(eq(comments.userId, user.id)),
  ]);
  const slugs = [...new Set([...liked, ...commented].map((r) => r.slug))];

  await deleteFolder(`u/${user.id}/`);
  await db.batch([
    db.delete(users).where(eq(users.id, user.id)),
    ...(user.email
      ? [db.delete(emailCodes).where(eq(emailCodes.email, user.email)), db.delete(passwordResets).where(eq(passwordResets.email, user.email))]
      : []),
    ...(slugs.length
      ? [
          db
            .update(dotStats)
            .set({
              likes: sql`(SELECT count(*) FROM dot_like WHERE dot_like.slug = ${dotStats.slug})`,
              comments: sql`(SELECT count(*) FROM comment WHERE comment.slug = ${dotStats.slug})`,
            })
            .where(inArray(dotStats.slug, slugs)),
        ]
      : []),
  ]);

  await signOut({ redirectTo: "/?account=deleted" }); // ends the session and leaves the page
  return { ok: true };
}
