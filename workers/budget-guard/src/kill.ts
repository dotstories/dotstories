// The stop: a flag in D1 (the app refuses uploads and file reads) + R2 public domains off.
import type { D1Database } from "@cloudflare/workers-types";

export type Stop = { at: string; estimateUsd: number; disabled: string[] }; // disabled: "custom:<domain>" | "managed"
export type Store = { get(): Promise<Stop | null>; save(stop: Stop): Promise<void> };
export type R2Env = { ACCOUNT_ID: string; R2_BUCKET: string; R2_DOMAIN: string; CF_API_TOKEN: string };

/** One row, id 1 (migrations/0005_budget_stop.sql). Shared with the app Worker. */
export function d1Store(db: D1Database): Store {
  return {
    async get() {
      const row = await db.prepare("SELECT at, estimateUsd, disabled FROM budget_stop WHERE id = 1").first<{
        at: string;
        estimateUsd: number;
        disabled: string;
      }>();
      return row ? { ...row, disabled: JSON.parse(row.disabled) as string[] } : null;
    },
    async save(stop) {
      await db
        .prepare(
          `INSERT INTO budget_stop (id, at, estimateUsd, disabled) VALUES (1, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET at = excluded.at, estimateUsd = excluded.estimateUsd, disabled = excluded.disabled`,
        )
        .bind(stop.at, stop.estimateUsd, JSON.stringify(stop.disabled))
        .run();
    },
  };
}

/** The bucket's public domains: "custom:<domain>" and "managed" (r2.dev). */
function domains(env: R2Env) {
  if (!env.R2_BUCKET) return [];
  return [...(env.R2_DOMAIN ? [`custom:${env.R2_DOMAIN}`] : []), "managed"];
}

/** GET (enabled = null) or PUT a domain's state. Mirrored in scripts/budget-reset.mjs. */
async function setDomain(env: R2Env, domain: string, enabled: boolean | null, f: typeof fetch) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/r2/buckets/${env.R2_BUCKET}/domains`;
  const url = domain === "managed" ? `${base}/managed` : `${base}/custom/${domain.slice("custom:".length)}`;
  const res = await f(url, {
    method: enabled === null ? "GET" : "PUT",
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json" },
    ...(enabled === null ? {} : { body: JSON.stringify({ enabled }) }),
  });
  if (!res.ok) throw new Error(`${domain}: HTTP ${res.status}`);
  return ((await res.json()) as { result?: { enabled?: boolean } }).result?.enabled ?? false;
}

/** Flag first (that alone stops the app), then each public domain that is on. Never throws on a domain. */
export async function kill(env: R2Env, store: Store, estimateUsd: number, now: Date, f: typeof fetch = fetch): Promise<Stop> {
  const stop: Stop = { at: now.toISOString(), estimateUsd, disabled: [] };
  await store.save({ ...stop, disabled: [] });
  for (const domain of domains(env)) {
    try {
      if (await setDomain(env, domain, null, f)) {
        await setDomain(env, domain, false, f);
        stop.disabled.push(domain);
      }
    } catch (e) {
      console.error(`Budget stop: couldn't turn off ${domain}: ${(e as Error).message}`);
    }
  }
  if (stop.disabled.length) await store.save(stop);
  return stop;
}
