/** @jest-environment node */
import { budgetCheck } from "../../lib/budget";

const db = (row: unknown) => ({ prepare: jest.fn(() => ({ first: jest.fn(async () => row) })) });

it("a stop in the database → stopped", async () => {
  expect(await budgetCheck()(db({ at: "x" }) as never)).toBe(true);
});

it("no stop → not stopped", async () => {
  expect(await budgetCheck()(db(null) as never)).toBe(false);
});

it("database error → not stopped (the guard is a safety net, not a single point of failure)", async () => {
  const broken = { prepare: () => ({ first: async () => Promise.reject(new Error("no table")) }) };
  expect(await budgetCheck()(broken as never)).toBe(false);
});

it("asks the database at most once a minute", async () => {
  const d = db(null);
  const check = budgetCheck(60_000);
  await check(d as never, 0);
  await check(d as never, 30_000);
  expect(d.prepare).toHaveBeenCalledTimes(1);
  await check(d as never, 61_000);
  expect(d.prepare).toHaveBeenCalledTimes(2);
});
