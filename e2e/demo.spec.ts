import { expect, type Page, type Route, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const RUNNER = "http://127.0.0.1:47761";
const INFO = {
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

/** Fakes the DotStories app on 127.0.0.1, like runner/engine/server.py. */
async function fakeRunner(page: Page) {
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
      return route.fulfill({
        headers: { ...CORS, "Content-Type": "image/jpeg" },
        body: readFileSync("public/demo/weeping-gate.jpg"),
      });
    return json({ error: "not found" }, 404);
  });
  return sent;
}

test("without the app: Run is disabled and the app is explained", async ({ page }) => {
  await page.route(`${RUNNER}/**`, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText(/get the free dotstories app/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
});

test("with the app: estimate, Run, progress, result", async ({ page }) => {
  const sent = await fakeRunner(page);
  await page.goto("/");

  await expect(page.getByText(/ready on rtx 4080 · ~5–15 seconds/i)).toBeVisible();
  await page.getByLabel(/prompt/i).fill("A lone tower in the fog");
  await page.getByRole("button", { name: "Run" }).click();

  const result = page.getByRole("img", { name: /your result/i });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("src", `${RUNNER}/jobs/abc/image`);
  expect(await result.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  expect(sent).toEqual([expect.objectContaining({ prompt: "A lone tower in the fog", seed: 54460995, steps: 8 })]);
});

test("on a phone: browse only, no Run", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("/");
  await expect(page.getByText(/needs a desktop computer/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeHidden();
  await page.close();
});
