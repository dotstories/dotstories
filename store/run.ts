import { create } from "zustand";
import type { Inputs, ShaderStep } from "@/lib/dot";
import {
  findRunner,
  getJob,
  getSetup,
  imageUrl,
  type JobStatus,
  loopbackPermission,
  type RunnerInfo,
  type Setup,
  type SetupLine,
  startJob,
} from "@/lib/runner";
import { runPostStep } from "@/lib/shader";

export type Runner =
  | { state: "idle" } // not asked yet: the browser will ask "connect to apps on this device?" on Run
  | { state: "checking" }
  | { state: "missing" } // no app on this computer
  | { state: "setup"; setup: Setup } // the app is installing Python + AI libraries (first start)
  | { state: "ready"; info: RunnerInfo }
  | { state: "blocked" }; // the user said no to the browser's question

type Pending = { inputs: Inputs; postSteps: ShaderStep[] };

type RunState = {
  runner: Runner;
  job: JobStatus | null;
  image: string | null;
  error: string | null;
  shading: boolean; // post-steps running in the browser
  installing: boolean; // the user pressed Run without the app: download + setup in progress
  logs: SetupLine[]; // the app's setup log, live
  pending: Pending | null; // what to run as soon as the app is ready
  watching: boolean;
  pollMs: number;
  watchMs: number;
  init: () => Promise<void>;
  checkRunner: () => Promise<void>;
  start: (inputs: Inputs, postSteps?: ShaderStep[], onMissing?: () => void) => Promise<void>;
  watch: () => Promise<void>;
  run: (inputs: Inputs, postSteps?: ShaderStep[]) => Promise<void>;
};

export const POLL_MS = 500;
export const WATCH_MS = 1000;
const MAX_LOGS = 2000;
const WATCH_FOR_MS = 2 * 60 * 60_000; // a slow first setup can take an hour
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useRunStore = create<RunState>((set, get) => ({
  runner: { state: "idle" },
  job: null,
  image: null,
  error: null,
  shading: false,
  installing: false,
  logs: [],
  pending: null,
  watching: false,
  pollMs: POLL_MS,
  watchMs: WATCH_MS,

  /** On page load: only look for the app if that won't make the browser ask (no popup for every visitor). */
  init: async () => {
    const permission = await loopbackPermission();
    if (permission === "denied") return set({ runner: { state: "blocked" } });
    if (permission === "prompt") return set({ runner: { state: "idle" } });
    await get().checkRunner();
  },

  /** Ready app → its info. Else the status server → setup progress + new log lines. Else missing. */
  checkRunner: async () => {
    if (get().runner.state === "idle") set({ runner: { state: "checking" } });
    const info = await findRunner();
    if (info) return set({ runner: { state: "ready", info } });
    const last = get().logs.at(-1);
    const since = last ? last.n + 1 : 0;
    const setup = await getSetup(since);
    if (setup) {
      // (Also "ready" here: the status server is up a moment before the engine answers.)
      // The app restarted (numbers start again at 0): start the log again too.
      const before = setup.next < since ? [] : get().logs;
      return set({ runner: { state: "setup", setup }, logs: [...before, ...setup.lines].slice(-MAX_LOGS) });
    }
    if ((await loopbackPermission()) === "denied") return set({ runner: { state: "blocked" } });
    set({ runner: { state: "missing" } });
  },

  /** The Run button: run now, or find/install the app first and run as soon as it's ready. */
  start: async (inputs, postSteps = [], onMissing) => {
    if (get().runner.state === "ready") return get().run(inputs, postSteps);
    set({ pending: { inputs, postSteps }, error: null });
    await get().checkRunner();
    const { runner } = get();
    if (runner.state === "ready") return get().watch();
    if (runner.state === "missing") {
      set({ installing: true });
      onMissing?.(); // e.g. start the installer download, still part of the Run click
    }
    if (runner.state !== "blocked") await get().watch();
  },

  /** Poll until the app is ready (installed, set up, started), then run what was asked. */
  watch: async () => {
    if (get().watching) return;
    set({ watching: true });
    const until = Date.now() + WATCH_FOR_MS;
    try {
      while (Date.now() < until) {
        if (get().runner.state === "ready") {
          const p = get().pending;
          set({ pending: null, installing: false });
          if (p) await get().run(p.inputs, p.postSteps);
          return;
        }
        if (get().runner.state === "blocked") return;
        await sleep(get().watchMs);
        await get().checkRunner();
      }
    } finally {
      set({ watching: false });
    }
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
      const res = await fetch(imageUrl(id));
      if (!res.ok) throw new Error(`Could not get the image from the app (${res.status})`);
      let image = await res.blob();
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
