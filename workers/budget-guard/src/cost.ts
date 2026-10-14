// Usage → estimated USD for the month. Pure. The invoice is the truth; this is a safety net.
// Prices checked 2026-10-14: https://developers.cloudflare.com/r2/pricing/ and /workers/platform/pricing/

export type Usage = { storageGB: number; opsA: number; opsB: number; workerRequests: number };

export const PRICES = {
  r2: {
    storage: { free: 10, perGB: 0.015 }, // GB-month (standard storage)
    classA: { free: 1_000_000, perMillion: 4.5 },
    classB: { free: 10_000_000, perMillion: 0.36 },
  },
  workersPaid: { base: 5, free: 10_000_000, perMillion: 0.3 },
};

const over = (used: number, free: number) => Math.max(0, used - free);

export function estimateUsd(u: Usage, { workersPaid = false } = {}): number {
  const { storage, classA, classB } = PRICES.r2;
  const w = PRICES.workersPaid;
  return (
    // Storage: the month's highest point, billed as if kept all month (conservative).
    over(u.storageGB, storage.free) * storage.perGB +
    (over(u.opsA, classA.free) / 1e6) * classA.perMillion +
    (over(u.opsB, classB.free) / 1e6) * classB.perMillion +
    (workersPaid ? w.base + (over(u.workerRequests, w.free) / 1e6) * w.perMillion : 0)
  );
}
