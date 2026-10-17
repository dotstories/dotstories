import { expect, test } from "@playwright/test";

const DOT = "/dots/dark-fantasy-thumbnail";

test("Copy link copies the page with your setup", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(DOT);
  await page.getByLabel(/prompt/i).fill("A lone tower");

  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Copy link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe("https://dotstories.com/dots/dark-fantasy-thumbnail?prompt=A+lone+tower");
});

test("Copy setup copies everything needed to reproduce it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${DOT}?seed=7`);
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("menuitem", { name: "Copy setup" }).click();
  const setup = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(setup).toMatchObject({ version: "1.1.0", engine: "krea2-turbo", inputs: { seed: 7, steps: 8 } });
});

test("shared links get a preview card with the prompt", async ({ page }) => {
  await page.goto(`${DOT}?prompt=A+lone+tower`);
  const meta = (p: string) => page.locator(`meta[property="${p}"], meta[name="${p}"]`).first();
  await expect(meta("og:title")).toHaveAttribute("content", "Dark Fantasy Thumbnail · DotStories");
  await expect(meta("og:description")).toHaveAttribute("content", "Prompt: A lone tower");
  await expect(meta("og:image")).toHaveAttribute("content", "https://dotstories.com/demo/weeping-gate.jpg");
  await expect(meta("twitter:card")).toHaveAttribute("content", "summary_large_image");
});

test("dot page shows the meta row and views", async ({ page }) => {
  await page.goto(DOT);
  await expect(page.getByText("Author", { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ Views/)).toBeVisible();
});
