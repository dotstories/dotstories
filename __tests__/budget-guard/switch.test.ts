/** @jest-environment node */
import { cfApi, d1Store, RULE_REF, restStore, resumeAll, status, type Stop, stopAll } from "../../workers/budget-guard/src/switch";

const cfg = { zone: "dotstories.com" };
type Rule = { id: string; ref?: string; enabled: boolean; action?: string; expression?: string };

/** A tiny fake of the Cloudflare API: one zone and its custom firewall rules. Anything else is an error. */
function cloudflare(state: { rules: Rule[] | null }, broken: string[] = []) {
  const ok = (result: unknown) => Response.json({ success: true, result });
  const calls: string[] = [];
  const f = jest.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace("https://api.cloudflare.com/client/v4", "");
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push(`${method} ${path}`);
    if (broken.some((b) => path.includes(b))) return Response.json({ success: false, errors: [{ message: "nope" }] }, { status: 500 });
    if (path === "/zones?name=dotstories.com") return ok([{ id: "z1" }]);
    if (path === "/zones/z1/rulesets/phases/http_request_firewall_custom/entrypoint") {
      if (method === "PUT") return ok((state.rules = body.rules.map((r: Rule, i: number) => ({ ...r, id: `r${i}` }))));
      return state.rules ? ok({ id: "rs1", rules: state.rules }) : Response.json({ success: false }, { status: 404 });
    }
    if (path === "/zones/z1/rulesets/rs1/rules" && method === "POST") {
      state.rules!.unshift({ ...body, id: "new" });
      return ok({});
    }
    const rule = path.match(/^\/zones\/z1\/rulesets\/rs1\/rules\/(\w+)$/);
    if (rule && method === "PATCH") {
      Object.assign(state.rules!.find((r) => r.id === rule[1])!, body);
      return ok({});
    }
    return Response.json({ success: false, errors: [{ message: `unexpected ${method} ${path}` }] }, { status: 400 });
  });
  return { api: cfApi("t", f as never), f, calls };
}

function memoryStore(initial: Stop | null = null) {
  let stop = initial;
  return {
    get: async () => stop,
    save: jest.fn(async (s: Stop) => void (stop = s)),
    clear: async () => void (stop = null),
  };
}

const killRule = (rules: Rule[] | null) => rules?.find((r) => r.ref === RULE_REF);

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

it("stop: flag first, then the firewall rule that blocks every dotstories.com host; nothing else is touched", async () => {
  const state = { rules: null };
  const { api, f, calls } = cloudflare(state);
  const store = memoryStore();
  const stop = await stopAll(api, store, cfg, { reason: "manual" }, new Date("2026-10-14T12:00:00Z"));

  expect(store.save.mock.calls[0][0]).toEqual({ at: "2026-10-14T12:00:00.000Z", reason: "manual", estimateUsd: 0, disabled: [] });
  expect(stop.disabled).toEqual(["firewall"]);
  expect(killRule(state.rules)).toMatchObject({ action: "block", enabled: true, expression: expect.stringContaining('ends_with(http.host, ".dotstories.com")') });
  expect(calls.every((c) => c.includes("/zones"))).toBe(true); // no R2 calls: the token needs no R2 access
  expect(await store.get()).toEqual(stop);
  expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer t" });
});

it("stop: other firewall rules stay; the kill rule goes first", async () => {
  const state = { rules: [{ id: "a", ref: "mine", enabled: true }] };
  await stopAll(cloudflare(state).api, memoryStore(), cfg, { reason: "budget", estimateUsd: 21 });
  expect(state.rules.map((r) => r.ref)).toEqual([RULE_REF, "mine"]);
});

it("stop: an existing kill rule is just turned on", async () => {
  const state = { rules: [{ id: "k", ref: RULE_REF, enabled: false }] };
  const { api, calls } = cloudflare(state);
  await stopAll(api, memoryStore(), cfg, { reason: "manual" });
  expect(killRule(state.rules)!.enabled).toBe(true);
  expect(calls).toContain("PATCH /zones/z1/rulesets/rs1/rules/k");
});

it("stop: a failing firewall call is logged and the flag stays", async () => {
  const store = memoryStore();
  const stop = await stopAll(cloudflare({ rules: null }, ["/rulesets/"]).api, store, cfg, { reason: "manual" });
  expect(stop.disabled).toEqual([]);
  expect(await store.get()).not.toBeNull();
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining("firewall"));
});

it("resume: firewall off, flag removed", async () => {
  const state = { rules: [{ id: "k", ref: RULE_REF, enabled: true }] };
  const store = memoryStore({ at: "x", reason: "budget", estimateUsd: 20, disabled: ["firewall"] });
  await resumeAll(cloudflare(state).api, store, cfg);
  expect(killRule(state.rules)!.enabled).toBe(false);
  expect(await store.get()).toBeNull();
});

it("resume when nothing was stopped does nothing harmful", async () => {
  const state = { rules: null };
  const { api, calls } = cloudflare(state);
  await resumeAll(api, memoryStore(), cfg);
  expect(calls.filter((c) => !c.startsWith("GET"))).toEqual([]);
});

it("status: the flag and the firewall rule", async () => {
  const state = { rules: [{ id: "k", ref: RULE_REF, enabled: true }] };
  const stop: Stop = { at: "x", reason: "manual", estimateUsd: 0, disabled: ["firewall"] };
  expect(await status(cloudflare(state).api, memoryStore(stop), cfg)).toEqual({ stop, firewall: true });
});

it("d1Store reads and writes the single row", async () => {
  const run = jest.fn(async () => ({}));
  const first = jest.fn(async () => ({ at: "x", reason: "budget", estimateUsd: 20, disabled: '["firewall"]' }));
  const bind = jest.fn(() => ({ run }));
  const prepare = jest.fn(() => ({ bind, run, first }));
  const store = d1Store({ prepare } as never);

  expect(await store.get()).toEqual({ at: "x", reason: "budget", estimateUsd: 20, disabled: ["firewall"] });
  await store.save({ at: "y", reason: "manual", estimateUsd: 0, disabled: [] });
  expect(prepare).toHaveBeenLastCalledWith(expect.stringMatching(/INSERT INTO budget_stop [\s\S]* ON CONFLICT/));
  expect(bind).toHaveBeenLastCalledWith("y", "manual", 0, "[]");
  await store.clear();
  expect(prepare).toHaveBeenLastCalledWith(expect.stringContaining("DELETE FROM budget_stop"));
});

it("restStore uses the D1 query API with parameters", async () => {
  const f = jest.fn(async (url: string) =>
    Response.json({
      success: true,
      result: url.includes("?name=") ? [{ uuid: "db1", name: "dotstories" }] : [{ results: [] }],
    }),
  );
  const store = restStore(cfApi("t", f as never), "acc", "dotstories");
  expect(await store.get()).toBeNull();
  await store.save({ at: "y", reason: "manual", estimateUsd: 0, disabled: [] });
  const [url, init] = f.mock.calls.at(-1) as unknown as [string, RequestInit];
  expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db1/query");
  expect(JSON.parse(String(init.body)).params).toEqual(["y", "manual", 0, "[]"]);
});
