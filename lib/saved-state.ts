import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { dotState } from "@/db/schema";
import type { Dot } from "./dot";
import { parseState, toQuery } from "./dot-state";
import { getDb } from "./db";

/** This person's saved setup for a dot (validated like a URL). */
export async function loadDotState(userId: string, dot: Dot) {
  const row = await getDb()
    .select({ state: dotState.state })
    .from(dotState)
    .where(and(eq(dotState.userId, userId), eq(dotState.slug, dot.slug)))
    .get();
  if (!row) return {};
  try {
    const raw = JSON.parse(row.state) as Record<string, unknown>;
    return parseState(dot, Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)])));
  } catch {
    return {};
  }
}

/**
 * The session, after one step: logged in and opened without a link, go to the saved
 * setup so the URL has it (refresh and share keep working). A link always wins.
 */
export async function sessionWithSetup(dot: Dot, path: string, search: Record<string, unknown>) {
  const session = await auth();
  if (!session || Object.keys(search).length) return session;
  const q = toQuery(dot, await loadDotState(session.user.id, dot));
  if (q) redirect(`${path}?${q}`);
  return session;
}
