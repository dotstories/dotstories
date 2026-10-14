import assert from "node:assert/strict";
import { test } from "node:test";
import { colo, report, summarize } from "./cache-stats.mjs";

const r = (cache, ms, ray = "abc-AMS", status = 200) => ({ status, cache, ray, ms });

test("colo comes from cf-ray", () => {
  assert.equal(colo("8f1c2a3b4c5d6e7f-AMS"), "AMS");
  assert.equal(colo(null), "?");
});

test("hit ratio counts only answers Cloudflare served without R2", () => {
  const s = summarize([r("MISS", 300), r("HIT", 20), r("HIT", 30), r("REVALIDATED", 25), r("EXPIRED", 200, "x-FRA")]);
  assert.equal(s.total, 5);
  assert.equal(s.hitRatio, 3 / 5);
  assert.deepEqual(s.byCache, { MISS: 1, HIT: 2, REVALIDATED: 1, EXPIRED: 1 });
  assert.deepEqual(s.colos, { AMS: 4, FRA: 1 });
  assert.equal(s.p50, 30);
  assert.equal(s.errors, 0);
});

test("errors and missing cache headers are visible", () => {
  const s = summarize([r(null, 10, "a-AMS", 403), r("DYNAMIC", 10)]);
  assert.equal(s.errors, 1);
  assert.deepEqual(s.byCache, { none: 1, DYNAMIC: 1 });
  assert.equal(s.hitRatio, 0);
});

test("a bot check (Bot Fight Mode) is reported, with what to do", () => {
  const s = summarize([{ ...r(null, 10, "a-AMS", 403), mitigated: "challenge" }, r("HIT", 10)]);
  assert.equal(s.challenged, 1);
  assert.match(report("https://x", s, 0.9), /bot check.*node scripts\/cache-test\.mjs/);
  assert.equal(summarize([r("HIT", 10)]).challenged, 0);
  assert.doesNotMatch(report("https://x", summarize([r("HIT", 10)]), 0.9), /bot check/);
});

test("report says pass/fail against the goal", () => {
  const good = summarize(Array.from({ length: 10 }, () => r("HIT", 20)));
  assert.match(report("https://x", good, 0.9), /^## ✅ Cache test: 100.0%/);
  const bad = summarize([r("MISS", 20), r("HIT", 20)]);
  assert.match(report("https://x", bad, 0.9), /^## ❌/);
});
