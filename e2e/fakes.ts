import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";

export const RUNNER = "http://127.0.0.1:47761";
export const SETUP = "http://127.0.0.1:47760"; // the app's status server (runner/app/src-tauri/src/status.rs)

export const INFO = {
  hardware: { device: "cuda", name: "RTX 4080", vram_gb: 16, ram_gb: 32 },
  tier: "nvidia-16",
  plan: "gpu-fp8-offload",
  estimate: { run_seconds: [5, 15], label: "~5–15 seconds", download_gb: 36, download_minutes: 36, warning: null },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** Fakes the DotStories app on 127.0.0.1, like runner/engine/server.py. Returns the jobs it received. */
export async function fakeRunner(page: Page, image = "e2e/fixtures/raw-weeping-gate.png", isUp = () => true) {
  const statuses = [
    { id: "abc", status: "loading", progress: null, error: null },
    { id: "abc", status: "running", progress: { step: 4, steps: 8, eta: 2 }, error: null },
    { id: "abc", status: "done", progress: { step: 8, steps: 8, eta: 0 }, error: null },
  ];
  const sent: unknown[] = [];
  await page.route(`${RUNNER}/**`, async (route: Route) => {
    if (!isUp()) return route.abort();
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: CORS, json: body });
    if (path === "/info") return json(INFO);
    if (path === "/jobs" && req.method() === "POST") {
      sent.push(req.postDataJSON());
      return json({ id: "abc" }, 202);
    }
    if (path === "/jobs/abc") return json(statuses.length > 1 ? statuses.shift() : statuses[0]);
    if (path === "/jobs/abc/image")
      return route.fulfill({ headers: { ...CORS, "Content-Type": "image/png" }, body: readFileSync(image) });
    return json({ error: "not found" }, 404);
  });
  return sent;
}

/** Replaces the Pyodide worker with one that returns the image unchanged (fast UI tests). */
export async function stubPython(page: Page) {
  await page.route("**/python-worker.mjs", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "self.onmessage = ({ data }) => self.postMessage({ id: data.id, png: data.image }, [data.image]);",
    }),
  );
}

type FakeLine = { n: number; t: number; text: string };

/** Fakes the app's status server while it sets itself up. `lines()` = the log so far; null = no app. */
export async function fakeSetup(page: Page, lines: () => FakeLine[] | null) {
  await page.route(`${SETUP}/**`, (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const all = lines();
    if (!all) return route.abort();
    const since = Number(new URL(route.request().url()).searchParams.get("since") ?? 0);
    return route.fulfill({
      headers: CORS,
      json: {
        phase: "installing",
        message: "Installing AI libraries…",
        version: "0.2.0",
        next: all.length,
        lines: all.filter((l) => l.n >= since),
      },
    });
  });
}

/** The browser's "connect to apps on this device?" answer, without a real prompt. */
export async function loopback(page: Page, state: "granted" | "prompt" | "denied") {
  await page.addInitScript((s) => {
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d: PermissionDescriptor) =>
      ["loopback-network", "local-network-access"].includes(d.name)
        ? Promise.resolve({ state: s } as PermissionStatus)
        : query(d);
  }, state);
}

/** A published release, and its installer as a download (no real GitHub). */
export async function fakeRelease(page: Page) {
  await page.route("https://api.github.com/repos/Dayonel/dotstories/releases/latest", (r) =>
    r.fulfill({ json: { tag_name: "runner-v0.2.0" } }),
  );
  await page.route("https://github.com/Dayonel/dotstories/releases/latest/download/**", (r) =>
    r.fulfill({
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" },
      body: "fake installer",
    }),
  );
}
