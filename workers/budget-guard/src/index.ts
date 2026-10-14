// dotstories-budget-guard: every hour, estimate this month's Cloudflare bill; over the budget → kill switch.
// Cloudflare has no spending cap (budget alerts only email), so this is ours. See README "Kill switch".
import type { D1Database, ExecutionContext, ScheduledController } from "@cloudflare/workers-types";
import { estimateUsd } from "./cost.ts";
import { type Api, cfApi, d1Store, type Store, stopAll } from "./switch.ts";
import { fetchUsage, periodStart } from "./usage.ts";

export type Config = {
  BUDGET_USD: string;
  ACCOUNT_ID: string;
  ZONE: string;
  R2_BUCKET: string;
  R2_DOMAIN: string;
  BILLING_DAY: string;
  WORKERS_PAID: string;
  CF_API_TOKEN: string;
};
export type Env = Config & { DB: D1Database };
export type Result = "ok" | "warning" | "stopped" | "already-stopped" | "error";

const WARN_AT = 0.8;

export async function check(env: Config, store: Store, now = new Date(), f: typeof fetch = fetch): Promise<Result> {
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
    const api: Api = cfApi(env.CF_API_TOKEN, f);
    const cfg = { zone: env.ZONE, bucket: env.R2_BUCKET, r2Domain: env.R2_DOMAIN };
    const stop = await stopAll(api, env.ACCOUNT_ID, store, cfg, { reason: "budget", estimateUsd: cost }, now);
    console.error(`KILL SWITCH (budget): $${cost.toFixed(2)} ≥ $${budget}. Stopped: ${stop.disabled.join(", ") || "app only"}`);
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
