import { expect, test } from "@playwright/test";

test("header and footer on the homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "DotStories" })).toBeVisible();
  await expect(page.getByRole("link", { name: /source code on github/i })).toBeVisible();
});

test("Carbon dark theme is applied", async ({ page }) => {
  await page.goto("/");
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--cds-background").trim(),
  );
  expect(bg).toBe("#161616"); // Carbon g100
});
