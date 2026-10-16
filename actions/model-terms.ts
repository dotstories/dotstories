"use server";

import { auth } from "@/auth";
import { modelTerms } from "@/db/schema";
import { getDb } from "@/lib/db";
import { MODELS, termsKey } from "@/lib/models";

const KNOWN = new Set(Object.values(MODELS).map((m) => termsKey(m!)));

/** Logged in: remember the accepted terms in D1 (every device). Logged out: the browser keeps them. */
export async function acceptModelTerms(terms: string) {
  const session = await auth();
  if (!session || !KNOWN.has(terms)) return;
  await getDb().insert(modelTerms).values({ userId: session.user.id, terms }).onConflictDoNothing();
}
