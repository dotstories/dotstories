// dotstories-budget-guard: every hour, estimate this month's Cloudflare bill; over the budget → stop.
// Cloudflare has no spending cap (budget alerts only email), so this is ours. See README "Budget stop & reset".
import type { D1Database, ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { estimateUsd } from "./cost";
import { d1Store, kill, type R2Env, type Store } from "./kill";
import { fetchUsage, periodStart } from "./usage";

export type Env = R2Env & { DB: D1Database; BUDGET_USD: string; BILLING_DAY: string; WORKERS_PAID: string };
export type Result = "ok" | "warning" | "stopped" | "already-stopped" | "error";

const WARN_AT = 0.8;

export async function check(env: Env, store: Store, now = new Date(), f: typeof fetch = fetch): Promise<Result> {
  const budget = Number(env.BUDGET_USD);
  if (!env.BUDGET_USD || !(budget >= 0) || !env.ACCOUNT_ID || !env.CF_API_TOKEN) {
    console.error("Budget guard: set BUDGET_USD, ACCOUNT_ID and the CF_API_TOKEN secret.");
    return "error";
  }
  if (await store.get()) return "already-stopped";

  let cost: number;
  try {
    const workersPaid = env.WORKERS_PAID === "true";
    const usage = await fetchUsage({
      accountId: env.ACCOUNT_ID,
      token: env.CF_API_TOKEN,
      from: periodStart(now, Number(env.BILLING_DAY) || 1),
      to: now,
      workersPaid,
      fetch: f,
    });
    cost = estimateUsd(usage, { workersPaid });
    console.log(`Budget guard: $${cost.toFixed(2)} of $${budget}`, usage);
  } catch (e) {
    // Can't see the bill → don't guess. Stopping on an outage would take the site down for nothing.
    console.error(`Budget guard: no estimate, nothing stopped. ${(e as Error).message}`);
    return "error";
  }

  if (cost >= budget) {
    const stop = await kill(env, store, cost, now, f);
    console.error(`BUDGET STOP: $${cost.toFixed(2)} ≥ $${budget}. Uploads and files are off. Turned off: ${stop.disabled.join(", ") || "-"}`);
    return "stopped";
  }
  if (cost >= budget * WARN_AT) {
    console.warn(`Budget guard: over 80% of the budget ($${cost.toFixed(2)} of $${budget}).`);
    return "warning";
  }
  return "ok";
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(check(env, d1Store(env.DB)));
  },
};
