import type { Download, WritableFolder } from "@dotstories/web-engine";
import { create } from "zustand";
import { encoderPrompt, type Inputs, type ShaderStep } from "@/lib/dot";
import type { ImageResult, ModelFiles, Progress } from "@/lib/engine/protocol";
import type { Support } from "@/lib/engine/support";
import type { HandleStore, ModelsFolder, Scan } from "@/lib/engine/models-folder";

/**
 * Run in the browser: check the browser, find the ComfyUI models folder, download what is missing,
 * make the image on this computer's graphics card, then the dot's post-steps. Nothing is uploaded.
 */
export type Phase =
  | { name: "checking" }
  | { name: "unsupported"; reason: string }
  | { name: "ready" }
  | { name: "missing"; missing: Download[]; bytes: number } // Download button
  | { name: "downloading"; done: number; total: number; file: string }
  | { name: "making"; progress: Progress }
  | { name: "shading" }
  | { name: "done"; seconds: number }
  | { name: "error"; message: string };

/** Everything the flow talks to, injected so the store is tested without a GPU or a real folder. */
export type Deps = {
  checkSupport(): Promise<Support>;
  folders: HandleStore;
  pick(store: HandleStore): Promise<ModelsFolder | null>;
  allowed(folder: ModelsFolder, mode: "read" | "readwrite", ask: boolean): Promise<boolean>;
  scan(folder: ModelsFolder): Promise<Scan>;
  download(folder: WritableFolder, missing: Download[], onProgress: (done: number, total: number, file: string) => void, options: { signal: AbortSignal }): Promise<void>;
  makeImage(request: { files: ModelFiles; prompt: string; width: number; height: number; seed: number }, options: { onProgress: (p: Progress) => void; signal: AbortSignal }): Promise<ImageResult>;
  toPng(result: ImageResult): Promise<Blob>;
  postStep(step: ShaderStep, image: Blob): Promise<Blob>;
};

type Job = { inputs: Inputs; postSteps: ShaderStep[] };

export type BrowserRun = {
  phase: Phase;
  gpu: string | null;
  folderName: string | null; // the remembered models folder
  image: string | null; // object URL of the last result
  init(): Promise<void>;
  run(inputs: Inputs, postSteps?: ShaderStep[]): Promise<void>; // from the Run click
  download(): Promise<void>; // from the Download click
  cancel(): void;
};

export const isBusy = (p: Phase) => ["checking", "downloading", "making", "shading"].includes(p.name);

export function createBrowserRun(deps: Deps) {
  let controller: AbortController | null = null;
  let folder: ModelsFolder | null = null;
  let pending: Job | null = null;

  return create<BrowserRun>((set, get) => {
    const fail = (e: unknown) =>
      set({ phase: controller?.signal.aborted ? { name: "ready" } : { name: "error", message: e instanceof Error ? e.message : String(e) } });

    /** Folder found and complete: make the image, then the post-steps. */
    const make = async (files: ModelFiles, { inputs, postSteps }: Job) => {
      const start = Date.now();
      const signal = (controller = new AbortController()).signal;
      set({ phase: { name: "making", progress: { stage: "text", message: "Starting…", fraction: 0 } } });
      const request = { files, prompt: encoderPrompt(inputs), width: inputs.width, height: inputs.height, seed: inputs.seed };
      const result = await deps.makeImage(request, { signal, onProgress: (progress) => set({ phase: { name: "making", progress } }) });
      let png = await deps.toPng(result);
      if (postSteps.length) set({ phase: { name: "shading" } });
      for (const step of postSteps) png = await deps.postStep(step, png);
      const old = get().image;
      if (old) URL.revokeObjectURL(old);
      set({ image: URL.createObjectURL(png), phase: { name: "done", seconds: Math.round((Date.now() - start) / 1000) } });
    };

    /** Scan the folder: complete → make; else ask to download what is missing. */
    const continueWith = async (job: Job) => {
      const scan = await deps.scan(folder!);
      if ("bytes" in scan) {
        pending = job;
        return set({ phase: { name: "missing", missing: scan.missing, bytes: scan.bytes } });
      }
      pending = null;
      await make(scan.files, job);
    };

    return {
      phase: { name: "checking" },
      gpu: null,
      folderName: null,
      image: null,

      init: async () => {
        const support = await deps.checkSupport();
        folder = (await deps.folders.get().catch(() => undefined)) ?? null;
        set({
          phase: support.ok ? { name: "ready" } : { name: "unsupported", reason: support.reason },
          gpu: support.ok ? support.gpu : null,
          folderName: folder?.name ?? null,
        });
      },

      run: async (inputs, postSteps = []) => {
        if (isBusy(get().phase) || get().phase.name === "unsupported") return;
        try {
          // The remembered folder (asks again for permission if the browser forgot), else pick one.
          if (!folder || !(await deps.allowed(folder, "read", true))) folder = await deps.pick(deps.folders);
          if (!folder) return set({ phase: { name: "ready" } }); // closed the picker
          set({ folderName: folder.name });
          await continueWith({ inputs, postSteps });
        } catch (e) {
          fail(e);
        } finally {
          controller = null;
        }
      },

      download: async () => {
        const phase = get().phase;
        if (phase.name !== "missing" || !folder || !pending) return;
        try {
          if (!(await deps.allowed(folder, "readwrite", true))) throw new Error("Saving into your models folder was not allowed.");
          const signal = (controller = new AbortController()).signal;
          set({ phase: { name: "downloading", done: 0, total: phase.bytes, file: phase.missing[0].name } });
          await deps.download(folder as unknown as WritableFolder, phase.missing, (done, total, file) => set({ phase: { name: "downloading", done, total, file } }), { signal });
          await continueWith(pending);
        } catch (e) {
          fail(e);
        } finally {
          controller = null;
        }
      },

      cancel: () => controller?.abort(),
    };
  });
}
