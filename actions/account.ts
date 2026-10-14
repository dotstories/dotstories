"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { accounts, comments, dotLikes, dotState, dotStats, emailCodes, passwordResets, retired, sessions, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { retiredHash } from "@/lib/retired-hash";
import { deleteFolder } from "@/lib/storage";
import { DELETED_PREFIX } from "@/lib/username";
import { getUserById } from "@/lib/users";

export type DeleteResult = { ok?: true; error?: string };

/**
 * Delete my account (GDPR right to erasure) without breaking what others rely on.
 *
 * Removed: email, name, picture, password, social logins, sessions, likes, saved setups, uploaded files,
 * pending codes and reset links, and the text of every comment (replies from others stay, under "[deleted]").
 * Kept: the user row, renamed "deleted_<id>", so threads and dots still point
 * somewhere. Nothing left in it identifies the person. Records the law makes us keep are
 * kept separately for that time only.
 * Retired for good: the email, username and social logins, stored only as hashes, so nobody can take over the
 * name (or come back after a ban) and the old author's links never point to someone else.
 */
export async function deleteAccount(_prev: DeleteResult, form: FormData): Promise<DeleteResult> {
  const session = await auth();
  if (!session) return { error: "Log in first." };
  const user = await getUserById(session.user.id);
  if (!user || user.deletedAt) return { error: "Log in first." };
  if (String(form.get("confirm") ?? "").trim().toLowerCase() !== user.username.toLowerCase())
    return { error: "Type your username exactly to confirm." };

  const db = getDb();
  const [liked, commented, logins] = await Promise.all([
    db.select({ slug: dotLikes.slug }).from(dotLikes).where(eq(dotLikes.userId, user.id)),
    db.select({ slug: comments.slug }).from(comments).where(eq(comments.userId, user.id)),
    db.select({ provider: accounts.provider, id: accounts.providerAccountId }).from(accounts).where(eq(accounts.userId, user.id)),
  ]);
  const hashes = await Promise.all([
    retiredHash("username", user.username),
    ...(user.email ? [retiredHash("email", user.email)] : []),
    ...logins.map((l) => retiredHash("login", `${l.provider}:${l.id}`)),
  ]);
  const slugs = [...new Set([...liked, ...commented].map((r) => r.slug))];
  const now = new Date();

  await deleteFolder(`u/${user.id}/`);
  await db.batch([
    db
      .insert(retired)
      .values(hashes.map((hash) => ({ hash })))
      .onConflictDoNothing(),
    db
      .update(users)
      .set({
        username: `${DELETED_PREFIX}${user.id.replace(/-/g, "").slice(0, 12)}`,
        name: null,
        email: null,
        emailVerified: null,
        image: null,
        password: null,
        deletedAt: now,
      })
      .where(eq(users.id, user.id)),
    db.delete(accounts).where(eq(accounts.userId, user.id)),
    db.delete(sessions).where(eq(sessions.userId, user.id)),
    db.delete(dotLikes).where(eq(dotLikes.userId, user.id)),
    db.delete(dotState).where(eq(dotState.userId, user.id)),
    db.update(comments).set({ text: "", deletedAt: now }).where(eq(comments.userId, user.id)),
    ...(user.email
      ? [db.delete(emailCodes).where(eq(emailCodes.email, user.email)), db.delete(passwordResets).where(eq(passwordResets.email, user.email))]
      : []),
    ...(slugs.length
      ? [
          db
            .update(dotStats)
            .set({
              likes: sql`(SELECT count(*) FROM dot_like WHERE dot_like.slug = ${dotStats.slug})`,
              comments: sql`(SELECT count(*) FROM comment WHERE comment.slug = ${dotStats.slug} AND comment.deletedAt IS NULL)`,
            })
            .where(inArray(dotStats.slug, slugs)),
        ]
      : []),
  ]);

  await signOut({ redirectTo: "/?account=deleted" }); // ends the session and leaves the page
  return { ok: true };
}
