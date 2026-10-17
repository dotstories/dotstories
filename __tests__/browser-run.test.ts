import { latest } from "../lib/dot";
import { darkFantasy } from "../lib/dots/dark-fantasy";
import type { ModelsFolder } from "../lib/engine/models-folder";
import { createBrowserRun, type Deps } from "../store/browser-run";

const v = latest(darkFantasy);
const FILES = { transformer: {}, textEncoder: {}, vae: {} } as never;
const MISSING = [{ folder: "vae", name: "qwen_image_vae.safetensors", size: 253806246 }];
const folder = { name: "models" } as ModelsFolder;
const image = { rgba: new Uint8ClampedArray(4), width: 1, height: 1, times: {} };

/** Fake deps; `missing` decides what the folder scan reports (until a download "fills" it). */
function setup(over: Partial<Deps> = {}, { remembered = null as ModelsFolder | null, missing = false } = {}) {
  let incomplete = missing;
  const calls: string[] = [];
  const deps: Deps = {
    checkSupport: async () => ({ ok: true, gpu: "NVIDIA GeForce RTX 4080" }),
    folders: { get: async () => remembered ?? undefined, set: async () => {} },
    pick: async () => (calls.push("pick"), folder),
    allowed: async (_f, mode) => (calls.push(`allowed ${mode}`), true),
    scan: async () => (incomplete ? { files: {}, missing: MISSING, bytes: 253806246 } : { files: FILES, missing: [] }),
    download: async (_f, _m, onProgress) => {
      calls.push("download");
      onProgress(100, 253806246, "qwen_image_vae.safetensors");
      incomplete = false;
    },
    makeImage: async (request, { onProgress }) => {
      calls.push(`make ${request.width}x${request.height} seed ${request.seed}`);
      onProgress({ stage: "steps", message: "Step 1 of 8…", fraction: 0.3 });
      calls.push(`prompt ${request.prompt.slice(0, 22)}`);
      return image;
    },
    toPng: async () => new Blob(["png"]),
    postStep: async (step, png) => (calls.push(`post ${step.type}`), png),
    ...over,
  };
  return { store: createBrowserRun(deps), calls };
}

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:result");
  URL.revokeObjectURL = jest.fn();
});

describe("browser run", () => {
  it("on load: checks the browser and names the GPU and the remembered folder", async () => {
    const { store } = setup({}, { remembered: folder });
    await store.getState().init();
    expect(store.getState()).toMatchObject({ phase: { name: "ready" }, gpu: "NVIDIA GeForce RTX 4080", folderName: "models" });
  });

  it("on load: an unsupported browser gets the reason and Run does nothing", async () => {
    const { store, calls } = setup({ checkSupport: async () => ({ ok: false, reason: "This browser has no WebGPU." }) });
    await store.getState().init();
    expect(store.getState().phase).toEqual({ name: "unsupported", reason: "This browser has no WebGPU." });
    await store.getState().run(v.inputs, v.postSteps);
    expect(calls).toEqual([]);
  });

  it("first Run: picks the folder, makes the image from the author's final prompt, then the post-steps", async () => {
    const { store, calls } = setup();
    await store.getState().init();
    await store.getState().run(v.inputs, v.postSteps);
    expect(calls).toEqual(["pick", "make 1928x1088 seed 54460995", "prompt **Scene Description:**", "post shader"]);
    expect(store.getState()).toMatchObject({ phase: { name: "done" }, image: "blob:result", folderName: "models" });
  });

  it("next Run: uses the remembered folder (asks again only if the browser forgot the permission)", async () => {
    const { store, calls } = setup({}, { remembered: folder });
    await store.getState().init();
    await store.getState().run(v.inputs, []);
    expect(calls.slice(0, 2)).toEqual(["allowed read", "make 1928x1088 seed 54460995"]);
  });

  it("closing the folder dialog goes back to ready", async () => {
    const { store, calls } = setup({ pick: async () => null });
    await store.getState().init();
    await store.getState().run(v.inputs, []);
    expect(store.getState().phase).toEqual({ name: "ready" });
    expect(calls).toEqual([]);
  });

  it("missing models: shows what and how big; Download (write permission) then makes the image", async () => {
    const { store, calls } = setup({}, { missing: true });
    await store.getState().init();
    await store.getState().run(v.inputs, []);
    expect(store.getState().phase).toEqual({ name: "missing", missing: MISSING, bytes: 253806246 });
    expect(calls).toEqual(["pick"]);

    await store.getState().download();
    expect(calls).toEqual(["pick", "allowed readwrite", "download", "make 1928x1088 seed 54460995", "prompt **Scene Description:**"]);
    expect(store.getState().phase.name).toBe("done");
  });

  it("shows progress while making the image", async () => {
    let seen: unknown;
    const { store } = setup({
      makeImage: async (_r, { onProgress }) => {
        onProgress({ stage: "steps", message: "Step 3 of 8…", fraction: 0.5 });
        seen = store.getState().phase;
        return image;
      },
    });
    await store.getState().init();
    await store.getState().run(v.inputs, []);
    expect(seen).toEqual({ name: "making", progress: { stage: "steps", message: "Step 3 of 8…", fraction: 0.5 } });
  });

  it("an edited prompt is used as written", async () => {
    let prompt = "";
    const { store } = setup({ makeImage: async (r) => ((prompt = r.prompt), image) });
    await store.getState().init();
    await store.getState().run({ ...v.inputs, finalPrompt: undefined, prompt: "A tower" }, []);
    expect(prompt).toBe(`A tower. ${v.inputs.style}`);
  });

  it("cancel goes back to ready, an engine error is shown", async () => {
    const { store } = setup({
      makeImage: (_r, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("x", "AbortError")))),
    });
    await store.getState().init();
    const running = store.getState().run(v.inputs, []);
    await new Promise((r) => setTimeout(r, 0));
    store.getState().cancel();
    await running;
    expect(store.getState().phase).toEqual({ name: "ready" });

    const failing = setup({ makeImage: async () => Promise.reject(new Error("No WebGPU adapter")) }).store;
    await failing.getState().init();
    await failing.getState().run(v.inputs, []);
    expect(failing.getState().phase).toEqual({ name: "error", message: "No WebGPU adapter" });
  });
});
