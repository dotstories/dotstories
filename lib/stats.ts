import "server-only";
import { eq, sql } from "drizzle-orm";
import { dotStats } from "@/db/schema";
import { getDb } from "./db";

export type DotStats = { views: number; likes: number; comments: number };
const ZERO: DotStats = { views: 0, likes: 0, comments: 0 };

export async function getStats(slug: string): Promise<DotStats> {
  const row = await getDb().select().from(dotStats).where(eq(dotStats.slug, slug)).get();
  return row ? { views: row.views, likes: row.likes, comments: row.comments } : ZERO;
}

export async function addView(slug: string) {
  await getDb()
    .insert(dotStats)
    .values({ slug, views: 1 })
    .onConflictDoUpdate({ target: dotStats.slug, set: { views: sql`${dotStats.views} + 1` } });
}
