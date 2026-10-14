"use server";

import { eq } from "drizzle-orm";
import { auth, unstable_update } from "@/auth";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { deleteFile, verifyUpload } from "@/lib/storage";
import { fileUrl, ownsKey } from "@/lib/uploads";
import { getUserById, usernameTaken } from "@/lib/users";
import { USERNAME } from "@/lib/username";

export type ProfileResult = { ok?: true; error?: string; username?: string; image?: string };

export async function saveUsername(value: unknown): Promise<ProfileResult> {
  const session = await auth();
  if (!session) return { error: "Log in first." };
  const parsed = USERNAME.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const username = parsed.data;

  if (await usernameTaken(username, session.user.id)) return { error: "That username is taken." };
  try {
    await getDb().update(users).set({ username }).where(eq(users.id, session.user.id));
  } catch {
    return { error: "That username is taken." }; // someone took it a moment ago
  }
  await unstable_update({}); // refresh the session: header shows the new name
  return { ok: true, username };
}

export async function savePicture(key: unknown): Promise<ProfileResult> {
  const session = await auth();
  if (!session) return { error: "Log in first." };
  if (typeof key !== "string" || !ownsKey(session.user.id, key)) return { error: "That's not your file." };

  const check = await verifyUpload(key);
  if (!check.ok) return { error: check.error };

  const before = await getUserById(session.user.id);
  const image = fileUrl(key);
  await getDb().update(users).set({ image }).where(eq(users.id, session.user.id));

  // Remove the old picture if it was uploaded here.
  const old = before?.image?.startsWith("/files/") ? before.image.slice("/files/".length) : null;
  if (old && ownsKey(session.user.id, old)) await deleteFile(old);

  await unstable_update({});
  return { ok: true, image };
}
