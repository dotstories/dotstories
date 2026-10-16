import type { Inputs } from "./dot";

/** The DotStories app on the user's computer. See runner/engine/src/dotstories_engine/server.py */
export const RUNNER_URL = "http://127.0.0.1:47761";
/** The app's own status server: answers from the first second, with the live setup log. See runner/app/src-tauri/src/status.rs */
export const SETUP_URL = "http://127.0.0.1:47760";

export type SetupLine = { n: number; t: number; text: string };
export type Setup = {
  phase: "starting" | "installing" | "ready" | "error" | "stopped";
  message: string;
  version: string;
  next: number; // ask "since next" for only the new lines
  lines: SetupLine[];
};

export type RunnerInfo = {
  hardware: { device: string; name: string; vram_gb: number; ram_gb: number };
  tier: string;
  plan: string;
  estimate: {
    run_seconds: [number, number];
    label: string;
    download_gb: number;
    download_minutes: number;
    warning: string | null;
  };
};

export type JobStatus = {
  id: string;
  status: "queued" | "loading" | "running" | "done" | "error";
  progress: { step: number; steps: number; eta: number } | null;
  error: string | null;
};

// Chrome's Local Network Access: requests from the site to this computer are marked "loopback".
const LOOPBACK = { targetAddressSpace: "loopback" } as RequestInit;

async function call<T>(path: string, init?: RequestInit, timeoutMs = 5000, base = RUNNER_URL): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...LOOPBACK, ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Runner error ${res.status}`);
  return body as T;
}

/**
 * null = the app is not installed or not running. A closed port fails at once; the long timeout is for
 * the browser's "connect to apps on this device?" question, which holds the request until answered.
 */
export async function findRunner(): Promise<RunnerInfo | null> {
  try {
    return await call<RunnerInfo>("/info", undefined, 60_000);
  } catch {
    return null;
  }
}

/** The app's setup status and new log lines; null = no app (or an old one without a status server). */
export async function getSetup(since = 0): Promise<Setup | null> {
  try {
    return await call<Setup>(`/status?since=${since}`, undefined, 60_000, SETUP_URL);
  } catch {
    return null;
  }
}

export type Permission = "granted" | "prompt" | "denied" | "unknown";

/**
 * May the site talk to apps on this computer? Chrome 145+ / Firefox 153+: "loopback-network",
 * Chrome 142–144: "local-network-access". "unknown": the browser doesn't ask (no prompt to avoid).
 */
export async function loopbackPermission(): Promise<Permission> {
  for (const name of ["loopback-network", "local-network-access"]) {
    try {
      const { state } = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
      return state;
    } catch {
      // not a permission this browser knows: try the next name
    }
  }
  return "unknown";
}

export const startJob = (inputs: Inputs) =>
  call<{ id: string }>("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });

export const getJob = (id: string) => call<JobStatus>(`/jobs/${id}`);

export const imageUrl = (id: string) => `${RUNNER_URL}/jobs/${id}/image`;
