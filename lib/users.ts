import "server-only";
import { eq, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { getDb } from "./db";
import { isRetired } from "./retired";
import { suggestUsername } from "./username";

export const getUserByEmail = (email: string) =>
  getDb().select().from(users).where(eq(users.email, email)).get();

export const getUserById = (id: string) => getDb().select().from(users).where(eq(users.id, id)).get();

/** In use, or used by an account that was deleted (those stay reserved for good). */
export const usernameTaken = async (username: string, exceptUserId?: string) => {
  const [row, retired] = await Promise.all([
    getDb().select({ id: users.id }).from(users).where(sql`${users.username} = ${username} COLLATE NOCASE`).get(),
    isRetired("username", username),
  ]);
  return retired || (!!row && row.id !== exceptUserId);
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
