import { expect, test } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DotStories/);
  await expect(page.getByRole("heading", { level: 1, name: "DotStories" })).toBeVisible();
});

test("example image is loaded", async ({ page }) => {
  await page.goto("/");
  const img = page.getByRole("img", { name: /the weeping gate/i });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});
