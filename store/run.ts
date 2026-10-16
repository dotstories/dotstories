import { create } from "zustand";
import type { Inputs, ShaderStep } from "@/lib/dot";
import { MODELS } from "@/lib/models";
import {
  type Access,
  findRunner,
  getAccess,
  getJob,
  getSetup,
  imageUrl,
  type JobStatus,
  loopbackPermission,
  type RunnerInfo,
  saveHfToken,
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
  jobLogs: SetupLine[]; // what the app does for this run (download, loading, steps), live
  showLog: boolean; // pressed Run: the log stays open
  pending: Pending | null; // what to run as soon as the app is ready (or has model access)
  access: Access | null; // set: the model needs the person's Hugging Face access first
  watching: boolean;
  pollMs: number;
  watchMs: number;
  init: () => Promise<void>;
  checkRunner: () => Promise<void>;
  start: (inputs: Inputs, postSteps?: ShaderStep[], onMissing?: () => void) => Promise<void>;
  watch: () => Promise<void>;
  run: (inputs: Inputs, postSteps?: ShaderStep[]) => Promise<void>;
  saveToken: (token: string) => Promise<void>;
  recheckAccess: () => Promise<void>;
};

// Image dots run on Krea 2 Turbo (lib/models.ts). Gated on Hugging Face.
const MODEL = MODELS["krea2-turbo"]!.repo;

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
  jobLogs: [],
  showLog: false,
  pending: null,
  access: null,
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
    set({ showLog: true });
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
    set({ job: null, image: null, error: null, shading: false, jobLogs: [] });
    // A gated model: first make sure this computer may download it (else the run fails after a while).
    const access = await getAccess(MODEL);
    if (access && access.status !== "ok") return set({ access, pending: { inputs, postSteps } });
    set({ access: null });
    let id: string;
    try {
      id = (await startJob(inputs)).id;
      let since = 0;
      for (;;) {
        const job = await getJob(id, since);
        const lines = job.log?.lines ?? [];
        since = job.log?.next ?? since;
        set({ job, jobLogs: [...get().jobLogs, ...lines].slice(-MAX_LOGS) });
        if (job.status === "done") break;
        if (job.status === "error" && job.code === "model-access") {
          // E.g. access was revoked since the check: show the steps again.
          const again = await getAccess(MODEL);
          return set({ job: null, access: again ?? { model: MODEL, status: "no-token", url: `https://huggingface.co/${MODEL}` }, pending: { inputs, postSteps } });
        }
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

  /** The person pasted their Hugging Face token: the app saves it and checks it. */
  saveToken: async (token) => {
    set({ error: null });
    try {
      const access = await saveHfToken(MODEL, token.trim());
      set({ access: access.status === "ok" ? null : access });
      if (access.status === "ok") await runPending(get);
    } catch (e) {
      set({ error: message(e) });
    }
  },

  /** Accepted the terms on Hugging Face (same token): ask again. */
  recheckAccess: async () => {
    set({ error: null });
    const access = await getAccess(MODEL);
    if (access && access.status !== "ok") return set({ access });
    set({ access: null });
    await runPending(get);
  },
}));

/** After the access steps: run what was asked. */
async function runPending(get: () => RunState) {
  const p = get().pending;
  if (!p) return;
  useRunStore.setState({ pending: null });
  await get().run(p.inputs, p.postSteps);
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const isRunning = (job: JobStatus | null, shading = false) =>
  shading || (!!job && ["queued", "loading", "running"].includes(job.status));
