// Undo a budget stop: turn the R2 domains the guard turned off back on, then remove the stop.
// Run it from GitHub → Actions → "Budget reset" → Run workflow (uses the repo secrets), or locally:
//   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/budget-reset.mjs
// The token needs D1 Edit + Workers R2 Storage Edit. The app notices within a minute.
import { readFileSync } from "node:fs";

const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!account || !token) {
  console.error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
  process.exit(1);
}
const guard = JSON.parse(readFileSync(new URL("../workers/budget-guard/wrangler.jsonc", import.meta.url), "utf8"));
const { R2_BUCKET: bucket } = guard.vars;
const dbName = guard.d1_databases[0].database_name;

async function api(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(`${path}: ${JSON.stringify(json.errors ?? res.status)}`);
  return json.result;
}

const db = (await api(`/d1/database?name=${dbName}`)).find((d) => d.name === dbName);
if (!db) throw new Error(`No D1 database "${dbName}"`);
const sql = async (query) => (await api(`/d1/database/${db.uuid}/query`, { method: "POST", body: JSON.stringify({ sql: query }) }))[0].results;

const [stop] = await sql("SELECT at, estimateUsd, disabled FROM budget_stop WHERE id = 1");
if (!stop) {
  console.log("No budget stop. Nothing to reset.");
  process.exit(0);
}
console.log(`Stopped at ${stop.at}, estimate $${Number(stop.estimateUsd).toFixed(2)}.`);

// Only what the stop turned off (r2.dev stays off if it was off before).
for (const domain of JSON.parse(stop.disabled)) {
  const path =
    domain === "managed"
      ? `/r2/buckets/${bucket}/domains/managed`
      : `/r2/buckets/${bucket}/domains/custom/${domain.slice("custom:".length)}`;
  await api(path, { method: "PUT", body: JSON.stringify({ enabled: true }) });
  console.log(`Turned back on: ${domain}`);
}
await sql("DELETE FROM budget_stop WHERE id = 1");
console.log("Budget stop removed. Uploads and files are back within a minute.");
console.log("The guard stops again next hour if this month's estimate is still over the budget: raise BUDGET_USD first if you meant to.");
