import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { RUNNER_URL, SETUP_URL } from "../lib/runner";
import { runPostStep } from "../lib/shader";
import { useRunStore } from "../store/run";

jest.mock("../lib/shader", () => ({ runPostStep: jest.fn() }));

const INFO = {
  hardware: { device: "cuda", name: "RTX 4080", vram_gb: 16, ram_gb: 32 },
  tier: "nvidia-16",
  plan: "gpu-fp8-offload",
  estimate: { run_seconds: [5, 15], label: "~5–15 seconds", download_gb: 36, download_minutes: 36, warning: null },
};

/** A fake runner: answers like runner/engine/server.py. */
function fakeRunner(statuses: object[]) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace(RUNNER_URL, "");
    calls.push(`${init?.method ?? "GET"} ${path}`);
    const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (path === "/jobs/abc/image") return { ok: true, status: 200, blob: async () => new Blob(["raw"]) };
    if (path === "/info") return json(INFO);
    if (path === "/jobs") return json({ id: "abc" }, 202);
    if (path === "/jobs/abc") return json(statuses.shift());
    return json({ error: "not found" }, 404);
  }) as unknown as typeof fetch;
  return calls;
}

const reset = () =>
  useRunStore.setState({
    runner: { state: "checking" },
    job: null,
    image: null,
    error: null,
    shading: false,
    installing: false,
    logs: [],
    pending: null,
    watching: false,
    pollMs: 0,
    watchMs: 0,
  });

/** The browser's answer to "connect to apps on this device?" */
const permission = (state: string) =>
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: jest.fn(async () => ({ state })) },
  });

const line = (n: number, text = `line ${n}`) => ({ n, t: n, text });
const setup = (next: number, lines: object[], phase = "installing") => ({
  phase,
  message: "Installing AI libraries…",
  version: "0.2.0",
  next,
  lines,
});

/**
 * The app over time: each check of the app reads the next entry.
 * "none" = no app, a Setup = the status server answers (engine not up yet), "ready" = the engine answers /info.
 */
function fakeApp(timeline: (object | "none" | "ready")[]) {
  const sinces: number[] = [];
  let now: object | "none" | "ready" = "none";
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
    if (url === `${RUNNER_URL}/info`) {
      now = timeline.length > 1 ? timeline.shift()! : timeline[0];
      if (now === "ready") return json(INFO);
      throw new TypeError("Failed to fetch");
    }
    if (url.startsWith(`${SETUP_URL}/status`)) {
      sinces.push(Number(new URL(url).searchParams.get("since")));
      if (now === "none" || now === "ready") throw new TypeError("Failed to fetch");
      return json(now);
    }
    if (url === `${RUNNER_URL}/jobs` && init?.method === "POST") return json({ id: "abc" }, 202);
    if (url === `${RUNNER_URL}/jobs/abc`) return json({ id: "abc", status: "done", progress: null, error: null });
    return json({ error: "not found" }, 404);
  }) as unknown as typeof fetch;
  return sinces;
}

describe("run store", () => {
  beforeEach(reset);

  it("finds the runner", async () => {
    fakeRunner([]);
    await useRunStore.getState().checkRunner();
    expect(useRunStore.getState().runner).toEqual({ state: "ready", info: INFO });
  });

  it("says missing when the app is not running", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await useRunStore.getState().checkRunner();
    expect(useRunStore.getState().runner.state).toBe("missing");
  });

  it("runs a dot: start, poll progress, show the image", async () => {
    const calls = fakeRunner([
      { id: "abc", status: "loading", progress: null, error: null },
      { id: "abc", status: "running", progress: { step: 4, steps: 8, eta: 2 }, error: null },
      { id: "abc", status: "done", progress: { step: 8, steps: 8, eta: 0 }, error: null },
    ]);
    await useRunStore.getState().run(latest(darkFantasy).inputs);

    const s = useRunStore.getState();
    expect(s.image).toBe(`${RUNNER_URL}/jobs/abc/image`);
    expect(s.error).toBeNull();
    expect(calls).toEqual(["POST /jobs", "GET /jobs/abc", "GET /jobs/abc", "GET /jobs/abc"]);

    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(sent).toEqual(latest(darkFantasy).inputs);
  });

  it("shows the runner's error", async () => {
    fakeRunner([{ id: "abc", status: "error", progress: null, error: "CUDA out of memory" }]);
    await useRunStore.getState().run(latest(darkFantasy).inputs);
    expect(useRunStore.getState().error).toBe("CUDA out of memory");
    expect(useRunStore.getState().image).toBeNull();
  });

  it("runs the dot's post-steps in the browser, then shows that image", async () => {
    fakeRunner([{ id: "abc", status: "done", progress: { step: 8, steps: 8, eta: 0 }, error: null }]);
    (runPostStep as jest.Mock).mockResolvedValue(new Blob(["card"]));
    URL.createObjectURL = jest.fn(() => "blob:card");
    const v = latest(darkFantasy);

    await useRunStore.getState().run(v.inputs, v.postSteps);

    expect(runPostStep).toHaveBeenCalledWith(v.postSteps[0], expect.any(Blob));
    expect(useRunStore.getState().image).toBe("blob:card");
    expect(useRunStore.getState().shading).toBe(false);
  });

  it("if a post-step fails, still shows the raw image and says why", async () => {
    fakeRunner([{ id: "abc", status: "done", progress: { step: 8, steps: 8, eta: 0 }, error: null }]);
    (runPostStep as jest.Mock).mockRejectedValue(new Error("pyodide failed"));
    const v = latest(darkFantasy);

    await useRunStore.getState().run(v.inputs, v.postSteps);

    expect(useRunStore.getState().image).toBe(`${RUNNER_URL}/jobs/abc/image`);
    expect(useRunStore.getState().error).toMatch(/pyodide failed/);
  });

  describe("one-click install", () => {
    afterEach(() => delete (navigator as { permissions?: unknown }).permissions);

    it("on page load, does not make the browser ask (no popup for every visitor)", async () => {
      permission("prompt");
      global.fetch = jest.fn() as unknown as typeof fetch;
      useRunStore.setState({ runner: { state: "idle" } });
      await useRunStore.getState().init();
      expect(useRunStore.getState().runner.state).toBe("idle");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("on page load, looks for the app when the browser already allows it", async () => {
      permission("granted");
      fakeApp(["ready"]);
      await useRunStore.getState().init();
      expect(useRunStore.getState().runner).toEqual({ state: "ready", info: INFO });
    });

    it("says blocked when the user said no to the browser", async () => {
      permission("denied");
      global.fetch = jest.fn() as unknown as typeof fetch;
      await useRunStore.getState().init();
      expect(useRunStore.getState().runner.state).toBe("blocked");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("shows the app's setup and adds only the new log lines", async () => {
      const sinces = fakeApp([setup(2, [line(0), line(1)]), setup(3, [line(2)])]);
      await useRunStore.getState().checkRunner();
      expect(useRunStore.getState().runner).toMatchObject({ state: "setup", setup: { message: "Installing AI libraries…" } });
      await useRunStore.getState().checkRunner();
      expect(useRunStore.getState().logs.map((l) => l.n)).toEqual([0, 1, 2]);
      expect(sinces).toEqual([0, 2]);
    });

    it("starts the log again when the app restarted", async () => {
      fakeApp([setup(5, [line(3), line(4)]), setup(1, [line(0, "fresh start")])]);
      await useRunStore.getState().checkRunner();
      await useRunStore.getState().checkRunner();
      expect(useRunStore.getState().logs).toEqual([line(0, "fresh start")]);
    });

    it("Run with the app ready: runs at once, no install", async () => {
      fakeApp(["ready"]);
      const onMissing = jest.fn();
      useRunStore.setState({ runner: { state: "ready", info: INFO } as never });
      await useRunStore.getState().start(latest(darkFantasy).inputs, [], onMissing);
      expect(onMissing).not.toHaveBeenCalled();
      expect(useRunStore.getState().image).toBe(`${RUNNER_URL}/jobs/abc/image`);
    });

    it("Run without the app: downloads the installer, follows the setup, then runs the dot by itself", async () => {
      fakeApp(["none", "none", setup(1, [line(0, "uv sync")]), "ready"]);
      const onMissing = jest.fn();
      await useRunStore.getState().start(latest(darkFantasy).inputs, [], onMissing);

      expect(onMissing).toHaveBeenCalledTimes(1);
      const s = useRunStore.getState();
      expect(s.logs).toEqual([line(0, "uv sync")]);
      expect(s.image).toBe(`${RUNNER_URL}/jobs/abc/image`);
      expect(s.installing).toBe(false);
      expect(s.pending).toBeNull();
      expect(s.watching).toBe(false);
    });

    it("Run with the app still setting up: no download, runs when ready", async () => {
      fakeApp([setup(1, [line(0)]), "ready"]);
      const onMissing = jest.fn();
      await useRunStore.getState().start(latest(darkFantasy).inputs, [], onMissing);
      expect(onMissing).not.toHaveBeenCalled();
      expect(useRunStore.getState().image).toBe(`${RUNNER_URL}/jobs/abc/image`);
    });

    it("stops waiting when the browser blocks the app", async () => {
      permission("denied");
      fakeApp(["none"]);
      const onMissing = jest.fn();
      await useRunStore.getState().start(latest(darkFantasy).inputs, [], onMissing);
      expect(useRunStore.getState().runner.state).toBe("blocked");
      expect(onMissing).not.toHaveBeenCalled();
      expect(useRunStore.getState().watching).toBe(false);
    });
  });
});
