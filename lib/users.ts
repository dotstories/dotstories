import "server-only";
import { eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "./db";
import { suggestUsername } from "./username";

export const getUserByEmail = (email: string) =>
  getDb().select().from(users).where(eq(users.email, email)).get();

export const getUserById = (id: string) => getDb().select().from(users).where(eq(users.id, id)).get();

export const usernameTaken = async (username: string, exceptUserId?: string) => {
  const row = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.username} = ${username} COLLATE NOCASE`)
    .get();
  return !!row && row.id !== exceptUserId;
};

/** A free username based on an email or name: "nestor", else "nestor4821". */
export async function uniqueUsername(from: string) {
  const base = suggestUsername(from);
  if (!(await usernameTaken(base))) return base;
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await usernameTaken(candidate))) return candidate;
  }
  return `user${crypto.randomUUID().slice(0, 8)}`;
}
