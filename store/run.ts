import { create } from "zustand";
import type { Inputs } from "@/lib/dot";
import { findRunner, getJob, imageUrl, type JobStatus, type RunnerInfo, startJob } from "@/lib/runner";

type Runner = { state: "checking" } | { state: "missing" } | { state: "ready"; info: RunnerInfo };

type RunState = {
  runner: Runner;
  job: JobStatus | null;
  image: string | null;
  error: string | null;
  pollMs: number;
  checkRunner: () => Promise<void>;
  run: (inputs: Inputs) => Promise<void>;
};

export const POLL_MS = 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useRunStore = create<RunState>((set, get) => ({
  runner: { state: "checking" },
  job: null,
  image: null,
  error: null,
  pollMs: POLL_MS,

  checkRunner: async () => {
    const info = await findRunner();
    set({ runner: info ? { state: "ready", info } : { state: "missing" } });
  },

  run: async (inputs) => {
    set({ job: null, image: null, error: null });
    try {
      const { id } = await startJob(inputs);
      for (;;) {
        const job = await getJob(id);
        set({ job });
        if (job.status === "done") return set({ image: imageUrl(id) });
        if (job.status === "error") return set({ error: job.error ?? "Something went wrong" });
        await sleep(get().pollMs);
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      await get().checkRunner(); // maybe the app was closed
    }
  },
}));

export const isRunning = (job: JobStatus | null) =>
  !!job && ["queued", "loading", "running"].includes(job.status);
