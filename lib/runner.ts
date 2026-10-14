import type { Inputs } from "./dot";

/** The DotStories app on the user's computer. See runner/engine/src/dotstories_engine/server.py */
export const RUNNER_URL = "http://127.0.0.1:47761";

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

async function call<T>(path: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
  const res = await fetch(`${RUNNER_URL}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Runner error ${res.status}`);
  return body as T;
}

/** null = the app is not installed or not running. */
export async function findRunner(): Promise<RunnerInfo | null> {
  try {
    return await call<RunnerInfo>("/info", undefined, 1500);
  } catch {
    return null;
  }
}

export const startJob = (inputs: Inputs) =>
  call<{ id: string }>("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });

export const getJob = (id: string) => call<JobStatus>(`/jobs/${id}`);

export const imageUrl = (id: string) => `${RUNNER_URL}/jobs/${id}/image`;
