import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import { RUNNER_URL } from "../lib/runner";
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
  useRunStore.setState({ runner: { state: "checking" }, job: null, image: null, error: null, shading: false, pollMs: 0 });

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
});
