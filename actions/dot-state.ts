"use server";

import { auth } from "@/auth";
import { dotState } from "@/db/schema";
import { type DotState, parseState } from "@/lib/dot-state";
import { getDb } from "@/lib/db";
import { findDot } from "@/lib/dots";

/** Logged in: remember this setup in D1. Logged out: nothing (the browser keeps it). */
export async function saveDotState(slug: string, state: DotState) {
  const session = await auth();
  const dot = findDot(slug);
  if (!session || !dot) return;
  const clean = parseState(dot, Object.fromEntries(Object.entries(state ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])));
  const json = JSON.stringify(clean);
  await getDb()
    .insert(dotState)
    .values({ userId: session.user.id, slug, state: json })
    .onConflictDoUpdate({ target: [dotState.userId, dotState.slug], set: { state: json, updatedAt: new Date() } });
}
