import { expect, test } from "@playwright/test";

const WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

test("Windows visitor gets the Windows installer", async ({ browser }) => {
  const context = await browser.newContext({ userAgent: WINDOWS_UA });
  const page = await context.newPage();
  await page.route("https://api.github.com/**", (r) => r.fulfill({ json: { tag_name: "runner-v0.1.0" } }));
  await page.goto("/download");
  await expect(page.getByRole("link", { name: /download for windows/i })).toHaveAttribute(
    "href",
    /releases\/latest\/download\/DotStories-Windows\.exe$/,
  );
  await expect(page.getByText(/more info → run anyway/i)).toBeVisible();
  await context.close();
});

test("before the first release: coming soon, no broken links", async ({ page }) => {
  await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 404, json: { message: "Not Found" } }));
  await page.goto("/download");
  await expect(page.getByText(/first release is coming soon/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /download for/i })).toHaveCount(0);
});
