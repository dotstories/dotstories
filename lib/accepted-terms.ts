import "server-only";
import { eq } from "drizzle-orm";
import { modelTerms } from "@/db/schema";
import { getDb } from "./db";

/** The model terms this person accepted (logged in). */
export async function acceptedTerms(userId: string): Promise<string[]> {
  const rows = await getDb().select({ terms: modelTerms.terms }).from(modelTerms).where(eq(modelTerms.userId, userId)).all();
  return rows.map((r) => r.terms);
}
