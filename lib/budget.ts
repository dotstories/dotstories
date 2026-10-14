import type { D1Database } from "@cloudflare/workers-types";

/**
 * Has the budget guard (workers/budget-guard) stopped spending? Then uploads and file reads answer 503.
 * Asks D1 at most once per `ttlMs` per Worker instance. Errors mean "not stopped": the guard is a safety net.
 */
export function budgetCheck(ttlMs = 60_000) {
  let cached: { stopped: boolean; until: number } | null = null;
  return async (db: D1Database, now = Date.now()) => {
    if (cached && now < cached.until) return cached.stopped;
    const stopped = await db
      .prepare("SELECT 1 FROM budget_stop WHERE id = 1")
      .first()
      .then((row) => !!row)
      .catch(() => false);
    cached = { stopped, until: now + ttlMs };
    return stopped;
  };
}

export const budgetStopped = budgetCheck();

export const pausedResponse = () =>
  Response.json(
    { error: "Uploads and files are paused for now. We're on it." },
    { status: 503, headers: { "Retry-After": "3600" } },
  );
