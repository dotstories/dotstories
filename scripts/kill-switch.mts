// The kill switch by hand: node scripts/kill-switch.mts status | stop | resume
// GitHub → Actions → "Kill switch" runs this with the repo secrets. Locally:
//   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=<the guard token> node scripts/kill-switch.mts status
// After stop/resume it checks the live sites until they answer as expected (blocked = HTTP 403).
import { appendFileSync, readFileSync } from "node:fs";
import { cfApi, restStore, resumeAll, status, stopAll } from "../workers/budget-guard/src/switch.ts";

const action = process.argv[2];
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token, GITHUB_STEP_SUMMARY } = process.env;
if (!["status", "stop", "resume"].includes(action ?? "") || !account || !token) {
  console.error("Usage: CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… node scripts/kill-switch.mts status|stop|resume");
  process.exit(1);
}

const guard = JSON.parse(readFileSync(new URL("../workers/budget-guard/wrangler.jsonc", import.meta.url), "utf8"));
const cfg = { zone: guard.vars.ZONE };
const files = guard.vars.FILES_DOMAIN; // R2 custom domain, once there is one
const api = cfApi(token);
const store = restStore(api, account, guard.d1_databases[0].database_name);
const sites = [`https://${cfg.zone}/`, `https://blog.${cfg.zone}/`, ...(files ? [`https://${files}/`] : [])];

const report: string[] = [];
const say = (line = "") => {
  console.log(line);
  report.push(line);
};

async function probe(url: string) {
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "Cache-Control": "no-cache" } });
    return res.status;
  } catch {
    return 0; // unreachable (e.g. no domain attached yet)
  }
}

/** Ask every site until all are blocked (stop) or none is (resume). Edge changes take a few seconds. */
async function verify(blocked: boolean) {
  let codes: number[] = [];
  for (let i = 0; i < 18; i++) {
    codes = await Promise.all(sites.map(probe));
    if (codes.every((c) => c === 0 || (c === 403) === blocked)) break; // 0: not set up yet, nothing to block
    await new Promise((r) => setTimeout(r, 5000));
  }
  say("| Site | HTTP | |");
  say("|---|---|---|");
  const mark = (c: number) => (c === 0 ? "⚠️ not reachable (not set up yet?)" : c === 403 ? "⛔ blocked" : "✅ open");
  sites.forEach((s, i) => say(`| ${s} | ${codes[i] || "-"} | ${mark(codes[i])} |`));
  return codes.some((c) => c !== 0) && codes.every((c) => c === 0 || (c === 403) === blocked);
}

let ok = true;
if (action === "stop") {
  const stop = await stopAll(api, store, cfg, { reason: "manual" });
  say(`## ⛔ Stopped\n\nTurned off: ${stop.disabled.join(", ") || "app only"}\n`);
  ok = (await verify(true)) && stop.disabled.includes("firewall");
} else if (action === "resume") {
  const stop = await resumeAll(api, store, cfg);
  say(`## ✅ Resumed\n\n${stop ? `Was stopped ${stop.at} (${stop.reason}).` : "Wasn't stopped."}\n`);
  ok = await verify(false);
} else {
  const s = await status(api, store, cfg);
  say(`## ${s.stop || s.firewall ? "⛔ Stopped" : "✅ Running"}\n`);
  if (s.stop) say(`Since ${s.stop.at} (${s.stop.reason}${s.stop.reason === "budget" ? `, estimate $${s.stop.estimateUsd.toFixed(2)}` : ""}).\n`);
  say(`Firewall block: ${s.firewall ? "on" : "off"}\n`);
  await verify(!!s.firewall);
}

if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, report.join("\n") + "\n");
if (!ok) {
  console.error("::error::Not every site answered as expected. Run it again, or check the firewall rule in Cloudflare → Security → WAF.");
  process.exit(1);
}
