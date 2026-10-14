/** @jest-environment node */
import { estimateUsd } from "../../workers/budget-guard/src/cost";

const free = { storageGB: 10, opsA: 1_000_000, opsB: 10_000_000, workerRequests: 10_000_000 };

it("inside the free tier costs nothing", () => {
  expect(estimateUsd(free)).toBe(0);
  expect(estimateUsd({ storageGB: 0, opsA: 0, opsB: 0, workerRequests: 0 })).toBe(0);
});

it("each line over the free tier", () => {
  expect(estimateUsd({ ...free, storageGB: 110 })).toBeCloseTo(1.5); // 100 GB × $0.015
  expect(estimateUsd({ ...free, opsA: 3_000_000 })).toBeCloseTo(9); // 2M × $4.50
  expect(estimateUsd({ ...free, opsB: 20_000_000 })).toBeCloseTo(3.6); // 10M × $0.36
});

it("Workers only count on the paid plan: $5 + requests over 10M", () => {
  expect(estimateUsd({ ...free, workerRequests: 20_000_000 })).toBe(0);
  expect(estimateUsd({ ...free, workerRequests: 20_000_000 }, { workersPaid: true })).toBeCloseTo(8); // 5 + 10M × $0.30
});

it("adds everything up", () => {
  expect(estimateUsd({ storageGB: 110, opsA: 3_000_000, opsB: 20_000_000, workerRequests: 0 })).toBeCloseTo(1.5 + 9 + 3.6);
});
