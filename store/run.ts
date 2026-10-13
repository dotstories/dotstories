import { create } from "zustand";
import type { Inputs, ShaderStep } from "@/lib/dot";
import { findRunner, getJob, imageUrl, type JobStatus, type RunnerInfo, startJob } from "@/lib/runner";
import { runPostStep } from "@/lib/shader";

type Runner = { state: "checking" } | { state: "missing" } | { state: "ready"; info: RunnerInfo };

type RunState = {
  runner: Runner;
  job: JobStatus | null;
  image: string | null;
  error: string | null;
  shading: boolean; // post-steps running in the browser
  pollMs: number;
  checkRunner: () => Promise<void>;
  run: (inputs: Inputs, postSteps?: ShaderStep[]) => Promise<void>;
};

export const POLL_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useRunStore = create<RunState>((set, get) => ({
  runner: { state: "checking" },
  job: null,
  image: null,
  error: null,
  shading: false,
  pollMs: POLL_MS,

  checkRunner: async () => {
    const info = await findRunner();
    set({ runner: info ? { state: "ready", info } : { state: "missing" } });
  },

  run: async (inputs, postSteps = []) => {
    set({ job: null, image: null, error: null, shading: false });
    let id: string;
    try {
      id = (await startJob(inputs)).id;
      for (;;) {
        const job = await getJob(id);
        set({ job });
        if (job.status === "done") break;
        if (job.status === "error") return set({ error: job.error ?? "Something went wrong" });
        await sleep(get().pollMs);
      }
    } catch (e) {
      set({ error: message(e) });
      return get().checkRunner(); // maybe the app was closed
    }

    if (!postSteps.length) return set({ image: imageUrl(id) });
    set({ shading: true });
    try {
      let image = await (await fetch(imageUrl(id))).blob();
      for (const step of postSteps) image = await runPostStep(step, image);
      set({ image: URL.createObjectURL(image) });
    } catch (e) {
      set({ error: `Finishing touches failed: ${message(e)}`, image: imageUrl(id) });
    } finally {
      set({ shading: false });
    }
  },
}));

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const isRunning = (job: JobStatus | null, shading = false) =>
  shading || (!!job && ["queued", "loading", "running"].includes(job.status));
