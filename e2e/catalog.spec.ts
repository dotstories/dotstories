import { expect, test } from "@playwright/test";

test("catalog lists dots and opens a dot page", async ({ page }) => {
  await page.goto("/dots");
  await expect(page.getByRole("heading", { level: 1, name: "Dots" })).toBeVisible();

  await page.getByRole("link", { name: /dark fantasy thumbnail/i }).click();
  await expect(page).toHaveURL(/\/dots\/dark-fantasy-thumbnail$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dark Fantasy Thumbnail" })).toBeVisible();
  await expect(page.getByLabel("Version")).toHaveValue("1.1.0");
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
  await expect(page.getByRole("link", { name: /fork on github/i })).toHaveAttribute("href", /github\.com/);
  await expect(page.getByText(/krea 2 community license/i).first()).toBeVisible();
});

test("header links to the catalog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("banner").getByRole("link", { name: "Dots", exact: true }).click();
  await expect(page).toHaveURL(/\/dots$/);
});

test("unknown dot is a 404", async ({ page }) => {
  const res = await page.goto("/dots/does-not-exist");
  expect(res?.status()).toBe(404);
});
