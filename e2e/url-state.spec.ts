import { expect, test } from "@playwright/test";

const DOT = "/dots/dark-fantasy-thumbnail";

test("refresh keeps what you typed", async ({ page }) => {
  await page.goto(DOT);
  await page.getByLabel(/prompt/i).fill("A lone tower in the fog");
  await page.getByLabel("Seed").fill("42");
  await page.getByLabel("Seed").blur();
  await expect(page).toHaveURL(/prompt=A\+lone\+tower/);
  await expect(page).toHaveURL(/seed=42/);

  await page.reload();
  await expect(page.getByLabel(/prompt/i)).toHaveValue("A lone tower in the fog");
  await expect(page.getByLabel("Seed")).toHaveValue("42");
});

test("a shared link opens with that setup", async ({ page }) => {
  await page.goto(`${DOT}?prompt=Shared+prompt&seed=7`);
  await expect(page.getByLabel(/prompt/i)).toHaveValue("Shared prompt");
  await expect(page.getByLabel("Seed")).toHaveValue("7");
});

test("coming back without a link restores your last setup (logged out)", async ({ page }) => {
  await page.goto(DOT);
  await page.getByLabel(/prompt/i).fill("Saved in this browser");
  await expect(page).toHaveURL(/prompt=Saved/);

  await page.goto(DOT); // no query
  await expect(page).toHaveURL(/prompt=Saved/);
  await expect(page.getByLabel(/prompt/i)).toHaveValue("Saved in this browser");
});

test("version is kept in the URL too", async ({ page }) => {
  await page.goto(`${DOT}?v=1.0.0`);
  await expect(page.getByLabel("Version")).toHaveValue("1.0.0");
});
