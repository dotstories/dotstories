// Stress test the files CDN and see the cache work: many requests to one file, count Cloudflare cache hits.
//   node scripts/cache-test.mjs [url] [--requests 500] [--concurrency 25] [--min 0.95]
// GitHub: Actions → "Cache test" → Run workflow. The first request per data center is a MISS (R2 is read once),
// the rest should be HIT: no R2 cost, no Worker. Then see it in Cloudflare: Analytics & Logs → Cache.
import { appendFileSync } from "node:fs";
import { report, summarize } from "./cache-stats.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const url = args.find((a) => a.startsWith("http")) ?? "https://files.dotstories.com/cache-test/weeping-gate.jpg";
const requests = Math.min(opt("requests", 500), 5000); // a stress test, not an attack on ourselves
const concurrency = Math.min(opt("concurrency", 25), 100);
const min = opt("min", 0.95);

async function one() {
  const start = performance.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": "dotstories-cache-test" } });
    await res.arrayBuffer(); // download the body, like a browser
    return { status: res.status, cache: res.headers.get("cf-cache-status"), ray: res.headers.get("cf-ray"), ms: Math.round(performance.now() - start) };
  } catch {
    return { status: 0, cache: null, ray: null, ms: Math.round(performance.now() - start) };
  }
}

console.log(`Warming up ${url} …`);
const first = await one();
console.log(`First request: HTTP ${first.status}, cache ${first.cache ?? "none"} (${first.ms} ms)`);

let next = 0;
const results = [];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next++ < requests) results.push(await one());
  }),
);

const s = summarize(results);
const text = report(url, s, min);
console.log(`\n${text}`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
if (s.errors || s.hitRatio < min) process.exit(1);
