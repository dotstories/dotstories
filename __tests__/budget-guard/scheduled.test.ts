/** @jest-environment node */
import { check } from "../../workers/budget-guard/src/index";
import type { Stop } from "../../workers/budget-guard/src/kill";

const env = {
  BUDGET_USD: "19",
  ACCOUNT_ID: "acc",
  R2_BUCKET: "",
  R2_DOMAIN: "",
  BILLING_DAY: "1",
  WORKERS_PAID: "false",
  CF_API_TOKEN: "t",
};

/** GraphQL fake: this many Class A operations this month. */
const analytics = (opsA: number) =>
  jest.fn(async () =>
    Response.json({
      data: { viewer: { accounts: [{ storage: [], ops: [{ sum: { requests: opsA }, dimensions: { actionType: "PutObject" } }] }] } },
      errors: null,
    }),
  );
const usd = (dollars: number) => 1_000_000 + (dollars / 4.5) * 1_000_000; // Class A ops that cost this much

function memoryStore(initial: Stop | null = null) {
  let stop = initial;
  return { get: async () => stop, save: jest.fn(async (s: Stop) => void (stop = s)), clear: async () => void (stop = null) };
}

let warn: jest.SpyInstance, error: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  error = jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("under budget: nothing happens", async () => {
  const store = memoryStore();
  expect(await check(env, store, new Date(), analytics(usd(5)))).toBe("ok");
  expect(store.save).not.toHaveBeenCalled();
});

it("from 80%: a warning in the logs, no stop", async () => {
  const store = memoryStore();
  expect(await check(env, store, new Date(), analytics(usd(16)))).toBe("warning");
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("80%"));
  expect(store.save).not.toHaveBeenCalled();
});

it("over budget: stops, once", async () => {
  const store = memoryStore();
  expect(await check(env, store, new Date(), analytics(usd(20)))).toBe("stopped");
  expect(store.save).toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.stringContaining("BUDGET STOP"));

  const f = analytics(usd(30));
  expect(await check(env, store, new Date(), f)).toBe("already-stopped");
  expect(f).not.toHaveBeenCalled(); // doesn't even ask
});

it("analytics down: never stops, logs the error", async () => {
  const store = memoryStore();
  const down = jest.fn(async () => new Response("bad gateway", { status: 502 }));
  expect(await check(env, store, new Date(), down)).toBe("error");
  expect(store.save).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalledWith(expect.stringContaining("502"));
});

it("no budget set: refuses to run instead of stopping everything", async () => {
  expect(await check({ ...env, BUDGET_USD: "" }, memoryStore(), new Date(), analytics(0))).toBe("error");
});
