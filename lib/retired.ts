import "server-only";
import { eq } from "drizzle-orm";
import { retired } from "@/db/schema";
import { getDb } from "./db";
import { type RetiredKind, retiredHash } from "./retired-hash";

/** Was this email, username or social login used by an account that was deleted? Then it can't be used again. */
export async function isRetired(kind: RetiredKind, value: string) {
  const hash = await retiredHash(kind, value);
  return !!(await getDb().select({ hash: retired.hash }).from(retired).where(eq(retired.hash, hash)).get());
}
