/** @jest-environment node */
import { d1Store, kill, type Stop } from "../../workers/budget-guard/src/kill";

const API = "https://api.cloudflare.com/client/v4/accounts/acc/r2/buckets/files/domains";
const env = { ACCOUNT_ID: "acc", R2_BUCKET: "files", R2_DOMAIN: "files.dotstories.com", CF_API_TOKEN: "t" };

/** Cloudflare API fake: domains with an `enabled` state. */
function cloudflare(enabled: { custom: boolean; managed: boolean }, failPut = false) {
  return jest.fn(async (url: string, init?: RequestInit) => {
    const which = url.endsWith("/managed") ? "managed" : "custom";
    if (init?.method === "PUT") {
      if (failPut) return new Response("{}", { status: 500 });
      enabled[which] = JSON.parse(String(init.body)).enabled;
    }
    return Response.json({ success: true, result: { enabled: enabled[which] } });
  });
}

function memoryStore() {
  let stop: Stop | null = null;
  return { get: async () => stop, save: jest.fn(async (s: Stop) => void (stop = s)), clear: async () => void (stop = null) };
}

it("saves the stop first, then turns off the enabled R2 domains and remembers which", async () => {
  const state = { custom: true, managed: false };
  const f = cloudflare(state);
  const store = memoryStore();
  const stop = await kill(env, store, 20.5, new Date("2026-10-14T12:00:00Z"), f);

  expect(store.save.mock.calls[0][0]).toEqual({ at: "2026-10-14T12:00:00.000Z", estimateUsd: 20.5, disabled: [] }); // first: flag
  expect(stop.disabled).toEqual(["custom:files.dotstories.com"]); // r2.dev was already off: left alone
  expect(await store.get()).toEqual(stop);
  expect(state).toEqual({ custom: false, managed: false });
  expect(f).toHaveBeenCalledWith(`${API}/custom/files.dotstories.com`, expect.objectContaining({ method: "PUT" }));
  expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer t" });
});

it("turns off r2.dev too when it was on", async () => {
  const state = { custom: true, managed: true };
  const stop = await kill(env, memoryStore(), 25, new Date(), cloudflare(state));
  expect(stop.disabled).toEqual(["custom:files.dotstories.com", "managed"]);
  expect(state).toEqual({ custom: false, managed: false });
});

it("no bucket or domain configured: only the flag", async () => {
  const f = cloudflare({ custom: true, managed: true });
  const stop = await kill({ ...env, R2_BUCKET: "", R2_DOMAIN: "" }, memoryStore(), 25, new Date(), f);
  expect(stop.disabled).toEqual([]);
  expect(f).not.toHaveBeenCalled();
});

it("a failing domain call doesn't undo the stop", async () => {
  const store = memoryStore();
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const stop = await kill(env, store, 25, new Date(), cloudflare({ custom: true, managed: true }, true));
  expect(stop.disabled).toEqual([]);
  expect(await store.get()).not.toBeNull();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

it("d1Store reads and writes the single budget_stop row", async () => {
  const run = jest.fn(async () => ({}));
  const first = jest.fn(async () => ({ at: "x", estimateUsd: 20, disabled: '["managed"]' }));
  const bind = jest.fn(() => ({ run, first }));
  const prepare = jest.fn(() => ({ bind, run, first }));
  const store = d1Store({ prepare } as never);

  expect(await store.get()).toEqual({ at: "x", estimateUsd: 20, disabled: ["managed"] });
  await store.save({ at: "y", estimateUsd: 21, disabled: [] });
  expect(prepare).toHaveBeenLastCalledWith(expect.stringMatching(/INSERT INTO budget_stop .* ON CONFLICT/s));
  expect(bind).toHaveBeenLastCalledWith("y", 21, "[]");

  first.mockResolvedValueOnce(null as never);
  expect(await store.get()).toBeNull();
});
