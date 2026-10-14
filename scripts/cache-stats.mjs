// Pure helpers for scripts/cache-test.mjs (tested in cache-stats.test.mjs).

/** Cloudflare's data center from a cf-ray header ("8f1c2a3b4c5d6e7f-AMS" → "AMS"). */
export const colo = (ray) => (ray && ray.includes("-") ? ray.split("-").pop() : "?");

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);

/**
 * results: [{ status, cache, ray, ms }] → counts per cache status, hit ratio, latency, data centers.
 * HIT/STALE/UPDATING/REVALIDATED were served by Cloudflare without asking R2.
 */
export function summarize(results) {
  const byCache = {};
  const colos = {};
  for (const r of results) {
    byCache[r.cache || "none"] = (byCache[r.cache || "none"] ?? 0) + 1;
    colos[colo(r.ray)] = (colos[colo(r.ray)] ?? 0) + 1;
  }
  const fromCache = results.filter((r) => ["HIT", "STALE", "UPDATING", "REVALIDATED"].includes(r.cache)).length;
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  return {
    total: results.length,
    errors: results.filter((r) => !(r.status >= 200 && r.status < 400)).length,
    byCache,
    hitRatio: results.length ? fromCache / results.length : 0,
    p50: percentile(ms, 50),
    p95: percentile(ms, 95),
    colos,
  };
}

/** Markdown report for the terminal and the GitHub run summary. */
export function report(url, s, minRatio) {
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  return [
    `## ${s.hitRatio >= minRatio && !s.errors ? "✅" : "❌"} Cache test: ${pct(s.hitRatio)} served from Cloudflare's cache`,
    "",
    `\`${url}\` · ${s.total} requests · p50 ${s.p50} ms · p95 ${s.p95} ms · errors ${s.errors}`,
    "",
    "| Cache status | Requests |",
    "|---|---|",
    ...Object.entries(s.byCache).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    `Data centers: ${Object.entries(s.colos).map(([k, v]) => `${k} (${v})`).join(", ")}`,
    "",
    `Only MISS / EXPIRED requests reached R2 (and cost a read). Goal: ≥ ${pct(minRatio)} from cache.`,
  ].join("\n");
}
