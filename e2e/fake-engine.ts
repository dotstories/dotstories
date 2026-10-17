import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";

type Options = {
  missing?: string[]; // "folder/name" not in the fake models folder (downloaded on Download)
  image?: string; // PNG the fake engine "makes" (default: a grey 64 × 36 image)
  noWebGpu?: boolean;
};

/**
 * A browser that can run dots without a GPU: fake WebGPU adapter, fake ComfyUI models folder
 * (showDirectoryPicker) and a fake engine worker that returns `image`. Other workers (Pyodide) stay real.
 * Returns the requests the engine got.
 */
export async function fakeEngine(page: Page, { missing = [], image, noWebGpu = false }: Options = {}) {
  const png = image ? readFileSync(image).toString("base64") : null;
  const runs: { prompt: string; width: number; height: number; seed: number }[] = [];
  await page.exposeFunction("__engineRun", (r: (typeof runs)[number]) => void runs.push(r));
  await page.addInitScript(
    ({ missing, png, noWebGpu }) => {
      const w = window as unknown as Record<string, unknown>;
      const GB = 1024 ** 3;
      if (noWebGpu) Object.defineProperty(navigator, "gpu", { value: undefined });
      else
        Object.defineProperty(navigator, "gpu", {
          value: {
            requestAdapter: async () => ({
              limits: { maxStorageBufferBindingSize: 2 * GB, maxBufferSize: 4 * GB },
              info: { vendor: "nvidia", architecture: "lovelace", description: "NVIDIA GeForce RTX 4080" },
            }),
          },
        });

      // The models folder: files are just sizes; downloads land in `have`.
      const files: Record<string, number> = {
        "diffusion_models/krea2_turbo_fp8_scaled.safetensors": 13141730784,
        "text_encoders/qwen3vl_4b_fp8_scaled.safetensors": 5242467968,
        "vae/qwen_image_vae.safetensors": 253806246,
      };
      const have = new Set(Object.keys(files).filter((f) => !missing.includes(f)));
      const dir = (prefix: string, name: string): unknown => ({
        name,
        kind: "directory",
        queryPermission: async () => "granted",
        requestPermission: async () => "granted",
        getDirectoryHandle: async (n: string) => dir(`${prefix}${n}/`, n),
        getFileHandle: async (n: string, { create = false } = {}) => {
          const path = prefix + n;
          const part = path.endsWith(".part") ? path.slice(0, -5) : null;
          if (!part && !have.has(path) && !create) throw new DOMException("not found", "NotFoundError");
          return {
            getFile: async () => ({ name: n, size: part ? (have.has(part) ? 0 : (w.__written as number) ?? 0) : files[path] }),
            createWritable: async () => ({ seek: async () => {}, truncate: async () => {}, write: async (c: Uint8Array) => void (w.__written = ((w.__written as number) ?? 0) + c.byteLength), close: async () => {} }),
            move: async () => void have.add(part!),
          };
        },
      });
      w.showDirectoryPicker = async () => dir("", "models");
      // Hugging Face: each missing file, as many zero bytes as its size says (the fake folder only counts them).
      const realFetch = window.fetch.bind(window);
      window.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
        const u = String(url);
        if (!u.startsWith("https://huggingface.co/Comfy-Org/Krea-2/")) return realFetch(url, init);
        const path = u.split("/resolve/main/")[1];
        w.__written = 0;
        const size = files[path];
        const body = new ReadableStream({
          pull(c) {
            const left = size - (w.__written as number);
            if (left <= 0) return c.close();
            c.enqueue(new Uint8Array(Math.min(left, 64 * 1024 ** 2)));
          },
        });
        return new Response(body, { status: 200 });
      }) as typeof fetch;

      // The engine worker: answers like lib/engine/worker.ts.
      const RealWorker = window.Worker;
      class FakeEngine {
        onmessage: ((e: { data: unknown }) => void) | null = null;
        onerror = null;
        postMessage(m: { type: string; request?: { prompt: string; width: number; height: number; seed: number } }) {
          if (m.type !== "run" || !m.request) return;
          const { prompt, width, height, seed } = m.request;
          void (w.__engineRun as (r: unknown) => Promise<void>)({ prompt, width, height, seed });
          setTimeout(async () => {
            this.onmessage?.({ data: { type: "progress", progress: { stage: "steps", message: "Step 1 of 8…", fraction: 0.3 } } });
            let rgba: Uint8ClampedArray;
            let [iw, ih] = [64, 36];
            if (png) {
              const bitmap = await createImageBitmap(await (await realFetch(`data:image/png;base64,${png}`)).blob());
              [iw, ih] = [bitmap.width, bitmap.height];
              const canvas = new OffscreenCanvas(iw, ih);
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(bitmap, 0, 0);
              rgba = ctx.getImageData(0, 0, iw, ih).data;
            } else rgba = new Uint8ClampedArray(iw * ih * 4).fill(128);
            this.onmessage?.({ data: { type: "done", result: { rgba, width: iw, height: ih, times: {} } } });
          }, 50);
        }
        terminate() {}
      }
      w.Worker = function (url: string | URL, options?: WorkerOptions) {
        return String(url).includes("python-worker") ? new RealWorker(url, options) : new FakeEngine();
      };
    },
    { missing, png, noWebGpu },
  );
  return runs;
}
