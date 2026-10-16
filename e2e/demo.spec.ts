import { expect, test } from "@playwright/test";
import { fakeRelease, fakeRunner, fakeSetup, loopback, RUNNER, SETUP, stubPython } from "./fakes";

test("without the app: Run offers to install it", async ({ page }) => {
  await loopback(page, "granted");
  await page.route(`${RUNNER}/**`, (route) => route.abort());
  await page.route(`${SETUP}/**`, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText(/press run to install it/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();
});

test("one click without the app: download, live setup log, then the dot runs by itself", async ({ page }) => {
  let log: { n: number; t: number; text: string }[] | null = null; // null = app not installed yet
  let engineUp = false;
  await loopback(page, "granted");
  await fakeRelease(page);
  await fakeSetup(page, () => log);
  const sent = await fakeRunner(page, undefined, () => engineUp);
  await stubPython(page);
  await page.goto("/");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Run" }).click();
  expect((await download).url()).toMatch(/DotStories-(Windows\.exe|Mac\.dmg)$/);
  await expect(page.getByRole("region", { name: /install the dotstories app/i })).toBeVisible();

  log = [{ n: 0, t: 1, text: "Resolved 84 packages" }]; // the user opened the installer: the app sets up
  await expect(page.getByRole("log", { name: /setup log/i })).toContainText("Resolved 84 packages");
  log = [...log, { n: 1, t: 65, text: "Installed 84 packages" }];
  await expect(page.getByRole("log", { name: /setup log/i })).toContainText("Installed 84 packages");

  engineUp = true;
  await expect(page.getByRole("img", { name: /your result/i })).toBeVisible({ timeout: 15_000 });
  expect(sent).toHaveLength(1);
});

test("the browser blocks the app: says how to allow it", async ({ page }) => {
  await loopback(page, "denied");
  await page.goto("/");
  await expect(page.getByText(/your browser blocks the connection/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
});

test("before the browser asked: no lookup on page load", async ({ page }) => {
  let asked = 0;
  await loopback(page, "prompt");
  await page.route(`${RUNNER}/**`, (route) => (asked++, route.abort()));
  await page.goto("/");
  await expect(page.getByText(/click allow/i)).toBeVisible();
  expect(asked).toBe(0);
});

test("with the app: estimate, Run, progress, result", async ({ page }) => {
  await loopback(page, "granted");
  const sent = await fakeRunner(page);
  await stubPython(page);
  await page.goto("/");

  await expect(page.getByText(/ready on rtx 4080 · ~5–15 seconds/i)).toBeVisible();
  await page.getByLabel(/prompt/i).fill("A lone tower in the fog");
  await page.getByRole("button", { name: "Run" }).click();

  const result = page.getByRole("img", { name: /your result/i });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("src", /^blob:/);
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
