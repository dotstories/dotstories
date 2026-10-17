import { expect, test } from "@playwright/test";
import { fakeEngine } from "./fake-engine";
import { acceptedTerms, stubPython } from "./fakes";

test("Run in the browser: pick the models folder, make the image, add the title card", async ({ page }) => {
  await acceptedTerms(page);
  const runs = await fakeEngine(page);
  await stubPython(page);
  await page.goto("/");

  await expect(page.getByText(/runs on nvidia geforce rtx 4080, nothing is uploaded/i)).toBeVisible();
  await page.getByLabel(/prompt/i).fill("A lone tower in the fog");
  await page.getByRole("button", { name: "Run" }).click();

  const result = page.getByRole("img", { name: /your result/i });
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("src", /^blob:/);
  await expect(page.getByText(/done in \d+ s/i)).toBeVisible();
  expect(runs).toEqual([expect.objectContaining({ width: 1928, height: 1088, seed: 54460995 })]);
  expect(runs[0].prompt).toMatch(/^A lone tower in the fog\. Lineage 2 inspired/); // edited: no prompt refine
});

test("the dot as the author made it: the author's refined prompt goes to the engine", async ({ page }) => {
  await acceptedTerms(page);
  const runs = await fakeEngine(page);
  await stubPython(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("img", { name: /your result/i })).toBeVisible();
  expect(runs[0].prompt).toMatch(/^\*\*Scene Description:\*\*/);
});

test("missing models: lists them, downloads into the folder, then runs", async ({ page }) => {
  await acceptedTerms(page);
  const runs = await fakeEngine(page, { missing: ["vae/qwen_image_vae.safetensors"] });
  await stubPython(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Run" }).click();

  const panel = page.getByRole("region", { name: "Missing models" });
  await expect(panel).toContainText("vae/qwen_image_vae.safetensors · 0.3 GB");
  expect(runs).toHaveLength(0);
  await panel.getByRole("button", { name: "Download 0.3 GB" }).click();
  await expect(page.getByRole("img", { name: /your result/i })).toBeVisible({ timeout: 30_000 });
  await expect(panel).toBeHidden();
  expect(runs).toHaveLength(1);
});

test("a browser without WebGPU: says why, Run is disabled", async ({ page }) => {
  await fakeEngine(page, { noWebGpu: true });
  await page.goto("/");
  await expect(page.getByText(/this browser has no webgpu/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeDisabled();
});

test("on a phone: browse only, no Run", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("/");
  await expect(page.getByText(/needs a desktop computer/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Run" })).toBeHidden();
  await page.close();
});

test("first run: accept the model terms, then it runs; next time no question", async ({ page }) => {
  const runs = await fakeEngine(page);
  await stubPython(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Run" }).click();
  const dialog = page.getByRole("dialog", { name: /krea 2 turbo · terms of use/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Krea 2 Community License" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Accept and run" })).toBeDisabled();
  expect(runs).toHaveLength(0);

  await dialog.getByText(/i have read and agree/i).click();
  await dialog.getByRole("button", { name: "Accept and run" }).click();
  await expect(page.getByRole("img", { name: /your result/i })).toBeVisible();
  expect(runs).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByRole("dialog", { name: /terms of use/i })).toBeHidden();
  await expect.poll(() => runs.length).toBe(2);
});
