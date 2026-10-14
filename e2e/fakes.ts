import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";

export const RUNNER = "http://127.0.0.1:47761";

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
export async function fakeRunner(page: Page, image = "e2e/fixtures/raw-weeping-gate.png") {
  const statuses = [
    { id: "abc", status: "loading", progress: null, error: null },
    { id: "abc", status: "running", progress: { step: 4, steps: 8, eta: 2 }, error: null },
    { id: "abc", status: "done", progress: { step: 8, steps: 8, eta: 0 }, error: null },
  ];
  const sent: unknown[] = [];
  await page.route(`${RUNNER}/**`, async (route: Route) => {
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
