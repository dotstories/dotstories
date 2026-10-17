import { makeImage } from "../lib/engine/client";
import { createHandler, type Engine } from "../lib/engine/handler";
import type { FromWorker, ImageRequest, ImageResult, ToWorker } from "../lib/engine/protocol";

const request = { files: {}, prompt: "a gate", width: 64, height: 64, seed: 1 } as unknown as ImageRequest;
const result = (): ImageResult => ({ rgba: new Uint8ClampedArray(64 * 64 * 4), width: 64, height: 64, times: { steps: 1 } });

/** An engine that reports one progress, then waits until released or cancelled. */
function fakeEngine() {
  let release!: () => void;
  const engine: Engine = {
    generate: (_req, onProgress, signal) =>
      new Promise((resolve, reject) => {
        onProgress({ stage: "steps", message: "Step 1 of 8…", fraction: 0.3 });
        signal.addEventListener("abort", () => reject(signal.reason));
        release = () => resolve(result());
      }),
  };
  return { engine, release: () => release() };
}

describe("engine worker handler", () => {
  it("reports progress, then the image (its pixels transferred, not copied)", async () => {
    const { engine, release } = fakeEngine();
    const sent: [FromWorker, Transferable[] | undefined][] = [];
    const handle = createHandler(engine, (m, t) => sent.push([m, t]));
    const run = handle({ type: "run", request });
    release();
    await run;
    expect(sent.map(([m]) => m.type)).toEqual(["progress", "done"]);
    const [done, transfer] = sent[1];
    expect(transfer).toEqual([(done as Extract<FromWorker, { type: "done" }>).result.rgba.buffer]);
  });

  it("cancel stops the run and says so", async () => {
    const { engine } = fakeEngine();
    const sent: FromWorker[] = [];
    const handle = createHandler(engine, (m) => sent.push(m));
    const run = handle({ type: "run", request });
    await handle({ type: "cancel" });
    await run;
    expect(sent.at(-1)).toEqual({ type: "error", message: "Cancelled.", cancelled: true });
  });

  it("runs one image at a time", async () => {
    const { engine } = fakeEngine();
    const sent: FromWorker[] = [];
    const handle = createHandler(engine, (m) => sent.push(m));
    void handle({ type: "run", request });
    await handle({ type: "run", request });
    expect(sent).toContainEqual({ type: "error", message: "An image is already being made.", cancelled: false });
  });

  it("passes engine errors on", async () => {
    const sent: FromWorker[] = [];
    const handle = createHandler({ generate: () => Promise.reject(new Error("No WebGPU adapter")) }, (m) => sent.push(m));
    await handle({ type: "run", request });
    expect(sent).toEqual([{ type: "error", message: "No WebGPU adapter", cancelled: false }]);
  });
});

/** A worker that runs the real handler in this thread. */
function fakeWorker(engine: Engine) {
  const w = {
    onmessage: null as ((e: MessageEvent<FromWorker>) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
    terminated: false,
    handle: createHandler(engine, (data) => queueMicrotask(() => w.onmessage?.({ data } as MessageEvent<FromWorker>))),
    postMessage(message: ToWorker) {
      void w.handle(message);
    },
    terminate() {
      w.terminated = true;
    },
  };
  return w;
}

describe("makeImage", () => {
  it("resolves with the image, reports progress, and ends the worker", async () => {
    const { engine, release } = fakeEngine();
    const w = fakeWorker(engine);
    const seen: string[] = [];
    const image = makeImage(request, { onProgress: (p) => seen.push(p.message), worker: () => w });
    await Promise.resolve();
    release();
    await expect(image).resolves.toMatchObject({ width: 64, height: 64 });
    expect(seen).toEqual(["Step 1 of 8…"]);
    expect(w.terminated).toBe(true);
  });

  it("rejects with an AbortError when cancelled", async () => {
    const { engine } = fakeEngine();
    const w = fakeWorker(engine);
    const controller = new AbortController();
    const image = makeImage(request, { signal: controller.signal, worker: () => w });
    controller.abort();
    await expect(image).rejects.toMatchObject({ name: "AbortError" });
    expect(w.terminated).toBe(true);
  });

  it("rejects when the worker can't start", async () => {
    const w = fakeWorker(fakeEngine().engine);
    w.postMessage = () => w.onerror?.({ message: "" } as ErrorEvent);
    await expect(makeImage(request, { worker: () => w })).rejects.toThrow("The image engine could not start.");
  });
});
