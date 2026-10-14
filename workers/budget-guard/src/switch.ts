// The kill switch: stop everything that can cost money, and bring it back.
// Used by the budget guard (automatic) and by scripts/kill-switch.mts (the "Kill switch" GitHub button).
//
// Stop = 1. a row in D1 (the app answers 503 on uploads and files)
//        2. a Cloudflare firewall rule that blocks every *.dotstories.com host at the edge (no Worker, no R2 cost)
//        3. the R2 bucket's public domains that were on → off
// Resume undoes exactly what the stop did.
import type { D1Database } from "@cloudflare/workers-types";

export type Stop = { at: string; reason: "budget" | "manual"; estimateUsd: number; disabled: string[] };
export type Store = { get(): Promise<Stop | null>; save(stop: Stop): Promise<void>; clear(): Promise<void> };
export type SwitchConfig = { zone: string; bucket: string; r2Domain: string };

/** Cloudflare API: returns `result`, throws with the status on failure. */
export type Api = <T = unknown>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function cfApi(token: string, f: typeof fetch = fetch): Api {
  return async <T>(path: string, init: { method?: string; body?: unknown } = {}) => {
    const res = await f(`https://api.cloudflare.com/client/v4${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; result?: T; errors?: { message: string }[] };
    if (!res.ok || json.success === false)
      throw new ApiError(`${init.method ?? "GET"} ${path}: ${json.errors?.map((e) => e.message).join("; ") || res.status}`, res.status);
    return json.result as T;
  };
}

// ---- where the stop is remembered (one row, migrations 0005 + 0006) ----

type Row = { at: string; reason: Stop["reason"]; estimateUsd: number; disabled: string };
const toStop = (row: Row | null | undefined): Stop | null => (row ? { ...row, disabled: JSON.parse(row.disabled) as string[] } : null);
const SELECT = "SELECT at, reason, estimateUsd, disabled FROM budget_stop WHERE id = 1";
const UPSERT = `INSERT INTO budget_stop (id, at, reason, estimateUsd, disabled) VALUES (1, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET at = excluded.at, reason = excluded.reason, estimateUsd = excluded.estimateUsd, disabled = excluded.disabled`;
const DELETE = "DELETE FROM budget_stop WHERE id = 1";
const params = (s: Stop) => [s.at, s.reason, s.estimateUsd, JSON.stringify(s.disabled)];

/** Inside a Worker: the D1 binding. */
export function d1Store(db: D1Database): Store {
  return {
    get: async () => toStop(await db.prepare(SELECT).first<Row>()),
    save: async (s) => void (await db.prepare(UPSERT).bind(...params(s)).run()),
    clear: async () => void (await db.prepare(DELETE).run()),
  };
}

/** Outside (scripts): the same table through the D1 REST API. */
export function restStore(api: Api, accountId: string, dbName: string): Store {
  let uuid: Promise<string> | null = null;
  const dbId = () =>
    (uuid ??= api<{ uuid: string; name: string }[]>(`/accounts/${accountId}/d1/database?name=${dbName}`).then((list) => {
      const db = list.find((d) => d.name === dbName);
      if (!db) throw new Error(`No D1 database "${dbName}"`);
      return db.uuid;
    }));
  const sql = async (query: string, args: unknown[] = []) =>
    (await api<{ results: Row[] }[]>(`/accounts/${accountId}/d1/database/${await dbId()}/query`, {
      method: "POST",
      body: { sql: query, params: args },
    }))[0]?.results ?? [];
  return {
    get: async () => toStop((await sql(SELECT))[0]),
    save: async (s) => void (await sql(UPSERT, params(s))),
    clear: async () => void (await sql(DELETE)),
  };
}

// ---- the firewall rule ----

const PHASE = "http_request_firewall_custom";
export const RULE_REF = "dotstories_kill_switch";
type Rule = { id: string; ref?: string; enabled: boolean };

const killRule = (zone: string, enabled: boolean) => ({
  ref: RULE_REF,
  description: "DotStories kill switch: blocks everything (scripts/kill-switch.mts)",
  expression: `(http.host eq "${zone}" or ends_with(http.host, ".${zone}"))`,
  action: "block",
  enabled,
});

async function zoneId(api: Api, zone: string) {
  const [z] = await api<{ id: string }[]>(`/zones?name=${zone}`);
  if (!z) throw new Error(`No zone "${zone}" for this token`);
  return z.id;
}

async function entrypoint(api: Api, zid: string) {
  try {
    return await api<{ id: string; rules?: Rule[] }>(`/zones/${zid}/rulesets/phases/${PHASE}/entrypoint`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null; // no custom rules yet
    throw e;
  }
}

/** Turn the block rule on/off. Created on first use, always first in the list. Returns whether it is on. */
export async function setFirewall(api: Api, zone: string, enabled: boolean): Promise<boolean> {
  const zid = await zoneId(api, zone);
  const ep = await entrypoint(api, zid);
  const rule = ep?.rules?.find((r) => r.ref === RULE_REF);
  if (rule) await api(`/zones/${zid}/rulesets/${ep!.id}/rules/${rule.id}`, { method: "PATCH", body: killRule(zone, enabled) });
  else if (!enabled) return false; // nothing to turn off
  else if (ep) await api(`/zones/${zid}/rulesets/${ep.id}/rules`, { method: "POST", body: { ...killRule(zone, true), position: { index: 1 } } });
  else await api(`/zones/${zid}/rulesets/phases/${PHASE}/entrypoint`, { method: "PUT", body: { rules: [killRule(zone, true)] } });
  return enabled;
}

export async function firewallOn(api: Api, zone: string): Promise<boolean> {
  const ep = await entrypoint(api, await zoneId(api, zone));
  return !!ep?.rules?.find((r) => r.ref === RULE_REF)?.enabled;
}

// ---- R2 public domains ----

function r2Path(accountId: string, cfg: SwitchConfig, domain: string) {
  const base = `/accounts/${accountId}/r2/buckets/${cfg.bucket}/domains`;
  return domain === "managed" ? `${base}/managed` : `${base}/custom/${domain.slice("custom:".length)}`;
}
const r2Domains = (cfg: SwitchConfig) =>
  cfg.bucket ? [...(cfg.r2Domain ? [`custom:${cfg.r2Domain}`] : []), "managed"] : [];

// ---- stop / resume / status ----

/** Flag first (that alone stops uploads and files), then firewall, then R2 domains. A failing step never undoes the others. */
export async function stopAll(
  api: Api,
  accountId: string,
  store: Store,
  cfg: SwitchConfig,
  why: { reason: Stop["reason"]; estimateUsd?: number },
  now = new Date(),
): Promise<Stop> {
  const stop: Stop = { at: now.toISOString(), reason: why.reason, estimateUsd: why.estimateUsd ?? 0, disabled: [] };
  await store.save({ ...stop, disabled: [] });
  /** Runs one part of the stop; its name if it turned something off. */
  const step = async (name: string, run: () => Promise<boolean>) => {
    try {
      return (await run()) ? name : null;
    } catch (e) {
      console.error(`Kill switch: couldn't stop ${name}: ${(e as Error).message}`);
      return null;
    }
  };
  const done = await Promise.all([
    step("firewall", () => setFirewall(api, cfg.zone, true)),
    ...r2Domains(cfg).map((domain) =>
      step(domain, async () => {
        const { enabled } = await api<{ enabled: boolean }>(r2Path(accountId, cfg, domain));
        if (enabled) await api(r2Path(accountId, cfg, domain), { method: "PUT", body: { enabled: false } });
        return enabled; // only what was on is remembered (r2.dev stays off if it was off)
      }),
    ),
  ]);
  stop.disabled = done.filter((name): name is string => name !== null);
  await store.save(stop);
  return stop;
}

/** Undo: firewall off, turn back on what the stop turned off, remove the row. Throws if a step fails (run it again). */
export async function resumeAll(api: Api, accountId: string, store: Store, cfg: SwitchConfig) {
  const stop = await store.get();
  await setFirewall(api, cfg.zone, false); // always: also clears a rule left on by hand
  const domains = (stop?.disabled ?? []).filter((d) => d !== "firewall");
  await Promise.all(domains.map((d) => api(r2Path(accountId, cfg, d), { method: "PUT", body: { enabled: true } })));
  await store.clear();
  return stop;
}

export async function status(api: Api, store: Store, cfg: SwitchConfig) {
  return { stop: await store.get(), firewall: await firewallOn(api, cfg.zone) };
}
