import { expect, test } from "@playwright/test";
import { fakeRunner, RUNNER, stubPython } from "./fakes";

test("without the app: Run is disabled and the app is explained", async ({ page }) => {
  await page.route(`${RUNNER}/**`, (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText(/get the free dotstories app/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
});

test("with the app: estimate, Run, progress, result", async ({ page }) => {
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
